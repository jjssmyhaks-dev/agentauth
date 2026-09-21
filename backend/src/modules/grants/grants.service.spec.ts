import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrantsService } from './grants.service';
import { Grant, Agent } from '../../database/entities';
import { TokenService } from '../token/token.service';
import { IdentityService } from '../identity/identity.service';
import { PolicyEngineService } from '../policies/policy-engine.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalService } from '../approval/approval.service';
import { TriggerEmittersService } from '../policies/trigger-emitters.service';
import { DelegationService } from '../token/delegation.service';
import { NotFoundException } from '@nestjs/common';

describe('GrantsService', () => {
  let delegationService: { findActiveByChildJti: jest.Mock; resolveRootAgentId: jest.Mock };
  let service: GrantsService;
  let grantRepo: jest.Mocked<Repository<Grant>>;
  let tokenService: jest.Mocked<TokenService>;
  let identityService: jest.Mocked<IdentityService>;
  let policyEngine: jest.Mocked<PolicyEngineService>;

  const mockGrant: Partial<Grant> = {
    id: 'grant-1',
    agent_id: 'agent-1',
    org_id: 'org-1',
    resource_type: 'database',
    resource_pattern: 'users/*',
    allowed_actions: ['read', 'write'],
    status: 'active',
    usage_count: 0,
    usage_cap: 100,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrantsService,
        {
          provide: getRepositoryToken(Grant),
          useValue: {
            create: jest.fn().mockReturnValue(mockGrant),
            save: jest.fn().mockResolvedValue(mockGrant),
            find: jest.fn().mockResolvedValue([mockGrant]),
            findOne: jest.fn().mockResolvedValue(mockGrant),
            increment: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            verifyToken: jest.fn().mockResolvedValue({
              valid: true,
              agent_id: 'agent-1',
              approval_mode: 'autonomous',
            }),
          },
        },
        {
          provide: IdentityService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 'agent-1',
              org_id: 'org-1',
              status: 'active',
            } as Agent),
          },
        },
        {
          provide: PolicyEngineService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue({ matched: false, action: 'allow' }),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logEntry: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: ApprovalService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'approval-1', status: 'pending' }),
          },
        },
        {
          provide: TriggerEmittersService,
          useValue: {
            resourceSensitivity: jest.fn().mockResolvedValue({ fired: false, action: 'allow' }),
          },
        },
        {
          provide: DelegationService,
          useValue: {
            findActiveByChildJti: jest.fn().mockResolvedValue(null),
            resolveRootAgentId: jest.fn().mockResolvedValue('agent-root'),
            // Mirror the real narrowing semantics: intersect delegated scope
            // with the grant — resource type must match, actions intersect.
            narrowGrant: jest.fn(
              (scopes: any[], g: { resource_type: string; resource_pattern: string; allowed_actions: string[] }) => {
                for (const s of scopes) {
                  if (s.resource_type !== g.resource_type) continue;
                  const actions = s.allowed_actions.filter((a: string) => g.allowed_actions.includes(a));
                  if (actions.length === 0) continue;
                  return { resource_type: g.resource_type, resource_pattern: s.resource_pattern, allowed_actions: actions };
                }
                return null;
              },
            ),
          },
        },
      ],
    }).compile();

    service = module.get<GrantsService>(GrantsService);
    grantRepo = module.get(getRepositoryToken(Grant));
    tokenService = module.get(TokenService);
    identityService = module.get(IdentityService);
    policyEngine = module.get(PolicyEngineService);
    delegationService = module.get(DelegationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkPermission', () => {
    it('should allow when matching grant exists', async () => {
      const result = await service.checkPermission('valid-token', 'database', 'users/123', 'read');
      expect(result.allowed).toBe(true);
      expect(result.matched_grant_id).toBe('grant-1');
    });

    it('should deny with invalid token', async () => {
      tokenService.verifyToken.mockResolvedValueOnce({ valid: false, reason: 'expired' });
      const result = await service.checkPermission('bad-token', 'database', 'users/123', 'read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('invalid_token');
    });

    it('should deny when no matching grant', async () => {
      const result = await service.checkPermission('valid-token', 'api', 'endpoint', 'read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no_matching_grant');
    });

    it('should deny when usage cap reached', async () => {
      grantRepo.find.mockResolvedValueOnce([{
        ...mockGrant,
        usage_count: 100,
        usage_cap: 100,
      } as Grant]);
      const result = await service.checkPermission('valid-token', 'database', 'users/123', 'read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('usage_cap_reached');
    });

    it('should increment usage count on successful check', async () => {
      await service.checkPermission('valid-token', 'database', 'users/123', 'read');
      expect(grantRepo.increment).toHaveBeenCalledWith({ id: 'grant-1' }, 'usage_count', 1);
    });

    it('should deny when a policy denies the matched grant', async () => {
      policyEngine.evaluate.mockResolvedValueOnce({
        matched: true,
        policy_id: 'policy-deny',
        action: 'deny',
        reason: 'Policy "Lockdown" matched trigger "permission_check"',
      });
      const result = await service.checkPermission('valid-token', 'database', 'users/123', 'read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('policy_denied');
      expect(result.matched_policy_id).toBe('policy-deny');
      expect(grantRepo.increment).not.toHaveBeenCalled();
    });

    it('should require approval AND auto-create the pending approval when a policy demands it', async () => {
      policyEngine.evaluate.mockResolvedValueOnce({
        matched: true,
        policy_id: 'policy-hitl',
        action: 'require_approval',
        reason: 'Policy "HITL off-hours" matched',
      });
      const approvalService = (service as any).approvalService;
      const result = await service.checkPermission('valid-token', 'database', 'users/123', 'read');
      expect(result.allowed).toBe(true);
      expect(result.requires_approval).toBe(true);
      expect(result.matched_policy_id).toBe('policy-hitl');
      // The loop is closed: a decisionable approval now exists.
      expect(approvalService.create).toHaveBeenCalledWith(
        'agent-1',
        'read',
        'database:users/123',
        expect.objectContaining({ policy_id: 'policy-hitl', source: 'policy_engine' }),
      );
      expect(result.approval_id).toBe('approval-1');
    });

    it('still allows when the auto-created approval fails (best-effort)', async () => {
      policyEngine.evaluate.mockResolvedValueOnce({
        matched: true,
        policy_id: 'policy-hitl',
        action: 'require_approval',
      });
      (service as any).approvalService.create.mockRejectedValueOnce(new Error('db down'));
      const result = await service.checkPermission('valid-token', 'database', 'users/123', 'read');
      expect(result.allowed).toBe(true);
      expect(result.requires_approval).toBe(true);
      expect(result.approval_id).toBeUndefined();
    });

    it('should return step_up_required when a policy demands step-up auth', async () => {
      policyEngine.evaluate.mockResolvedValueOnce({
        matched: true,
        policy_id: 'policy-stepup',
        action: 'step_up',
        reason: 'Policy "Step-up deletes" matched',
      });
      const result = await service.checkPermission('valid-token', 'database', 'users/123', 'read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('step_up_required');
      expect(grantRepo.increment).not.toHaveBeenCalled();
    });

    it('should not require approval when no policy matches (autonomous)', async () => {
      const result = await service.checkPermission('valid-token', 'database', 'users/123', 'read');
      expect(result.allowed).toBe(true);
      expect(result.requires_approval).toBe(false);
    });

    it('derives authority from the ROOT agent grants for a delegated token', async () => {
      // Child agent has NO grants of its own; the root agent holds grant-1.
      grantRepo.find.mockResolvedValueOnce([mockGrant as Grant]);
      delegationService.findActiveByChildJti.mockResolvedValueOnce({
        id: 'delegation-1', depth: 1, parent_agent_id: 'agent-root', child_jti: 'child-jti',
      });
      delegationService.resolveRootAgentId.mockResolvedValueOnce('agent-root');
      tokenService.verifyToken.mockResolvedValueOnce({
        valid: true,
        agent_id: 'agent-child',
        approval_mode: 'autonomous',
        jti: 'child-jti',
        scopes: [{ resource_type: 'database', resource_pattern: 'users/*', allowed_actions: ['read', 'write'] }],
        delegation: { delegation_id: 'delegation-1', depth: 1, parent_agent_id: 'agent-root' },
      });

      const result = await service.checkPermission('child-token', 'database', 'users/123', 'read');

      // The query included the root agent's grants.
      expect(grantRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ agent_id: 'agent-root' }),
          ]),
        }),
      );
      expect(result.allowed).toBe(true);
    });

    it('enforces the NARROWED scopes: a read-only delegation cannot write', async () => {
      grantRepo.find.mockResolvedValueOnce([mockGrant as Grant]); // root grant: read+write
      delegationService.findActiveByChildJti.mockResolvedValueOnce({
        id: 'delegation-1', depth: 1, parent_agent_id: 'agent-root', child_jti: 'child-jti',
      });
      delegationService.resolveRootAgentId.mockResolvedValueOnce('agent-root');
      tokenService.verifyToken.mockResolvedValueOnce({
        valid: true,
        agent_id: 'agent-child',
        approval_mode: 'autonomous',
        jti: 'child-jti',
        scopes: [{ resource_type: 'database', resource_pattern: 'users/*', allowed_actions: ['read'] }],
        delegation: { delegation_id: 'delegation-1', depth: 1, parent_agent_id: 'agent-root' },
      });

      const result = await service.checkPermission('child-token', 'database', 'users/123', 'write');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no_matching_grant');
    });

    it('denies with delegation_revoked when the chain link is not active', async () => {
      delegationService.findActiveByChildJti.mockResolvedValueOnce(null);
      tokenService.verifyToken.mockResolvedValueOnce({
        valid: true,
        agent_id: 'agent-child',
        approval_mode: 'autonomous',
        jti: 'child-jti',
        delegation: { delegation_id: 'delegation-1', depth: 1 },
      });

      const result = await service.checkPermission('child-token', 'database', 'users/123', 'read');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('delegation_revoked');
    });

    it('denies with delegation_broken on a degenerate chain (root === caller)', async () => {
      delegationService.findActiveByChildJti.mockResolvedValueOnce({
        id: 'delegation-1', depth: 1, parent_agent_id: 'agent-child', child_jti: 'child-jti',
      });
      delegationService.resolveRootAgentId.mockResolvedValueOnce('agent-child');
      tokenService.verifyToken.mockResolvedValueOnce({
        valid: true,
        agent_id: 'agent-child',
        approval_mode: 'autonomous',
        jti: 'child-jti',
        delegation: { delegation_id: 'delegation-1', depth: 1 },
      });

      const result = await service.checkPermission('child-token', 'database', 'users/123', 'read');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('delegation_broken');
    });
  });

  describe('create', () => {
    it('should create a grant', async () => {
      const result = await service.create('agent-1', 'database', 'users/*', ['read'], 'user-1');
      expect(result).toBeDefined();
      expect(grantRepo.save).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('should revoke a grant', async () => {
      const result = await service.revoke('grant-1');
      expect(result.status).toBe('revoked');
      expect(result.revoked_at).toBeDefined();
    });
  });
});
