import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DelegationService, Scope } from './delegation.service';
import { TokenService } from './token.service';
import { AuditService } from '../audit/audit.service';
import { Agent, DelegatedToken } from '../../database/entities';

const ORG = '11111111-1111-4111-8111-111111111111';
const PARENT_AGENT = '22222222-2222-4222-8222-222222222222';
const CHILD_AGENT = '33333333-3333-4333-8333-333333333333';

function parentPayload(overrides: Partial<any> = {}) {
  return {
    valid: true,
    agent_id: PARENT_AGENT,
    jti: 'parent-jti',
    scopes: [
      {
        resource_type: 'document',
        resource_pattern: 'docs/*',
        allowed_actions: ['read', 'write'],
      },
    ] as Scope[],
    expires_at: new Date(Date.now() + 10 * 60_000),
    ...overrides,
  };
}

describe('DelegationService', () => {
  let service: DelegationService;
  let delegationRepo: { create: jest.Mock; save: jest.Mock; update: jest.Mock; findOne: jest.Mock; find: jest.Mock };
  let agentRepo: { findOne: jest.Mock };
  let tokenService: { verifyToken: jest.Mock; issueDelegatedToken: jest.Mock; revokeByJti: jest.Mock };
  let auditService: { logEntry: jest.Mock };

  const parentAgent = {
    id: PARENT_AGENT,
    org_id: ORG,
    status: 'active',
    approval_mode_override: null,
  };
  const childAgent = {
    id: CHILD_AGENT,
    org_id: ORG,
    status: 'active',
    approval_mode_override: null,
  };

  beforeEach(async () => {
    delegationRepo = {
      create: jest.fn((x) => ({ id: 'delegation-1', ...x })),
      save: jest.fn(async (x) => x),
      update: jest.fn(async () => undefined),
      findOne: jest.fn(async (q: any) => (q.where.child_jti ? null : ({ id: 'delegation-1', ...q.where } as any))),
      find: jest.fn(async () => []),
    };
    agentRepo = {
      findOne: jest.fn(async ({ where: { id } }: any) =>
        id === PARENT_AGENT ? parentAgent : id === CHILD_AGENT ? childAgent : null,
      ),
    };
    tokenService = {
      verifyToken: jest.fn(async () => parentPayload()),
      issueDelegatedToken: jest.fn(async () => 'child-token'),
      revokeByJti: jest.fn(async () => undefined),
    };
    auditService = { logEntry: jest.fn(async () => ({}) as any) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelegationService,
        { provide: getRepositoryToken(DelegatedToken), useValue: delegationRepo },
        { provide: getRepositoryToken(Agent), useValue: agentRepo },
        { provide: TokenService, useValue: tokenService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(DelegationService);
  });

  const request: Scope[] = [
    { resource_type: 'document', resource_pattern: 'docs/public/*', allowed_actions: ['read'] },
  ];

  it('mints a child token with narrowed scopes and chain trace', async () => {
    const result = await service.mint('parent-token', CHILD_AGENT, request, { purpose: 'quarterly report' });

    expect(result.token).toBe('child-token');
    expect(result.depth).toBe(1);

    const payload = tokenService.issueDelegatedToken.mock.calls[0][0];
    expect(payload.agent_id).toBe(CHILD_AGENT);
    expect(payload.scopes).toEqual([
      { resource_type: 'document', resource_pattern: 'docs/public/*', allowed_actions: ['read'] },
    ]);
    expect(payload.delegation).toMatchObject({
      depth: 1,
      parent_agent_id: PARENT_AGENT,
      root_principal_type: 'agent',
      root_principal_id: PARENT_AGENT,
    });

    // Chain-aware audit entry names the whole path.
    expect(auditService.logEntry).toHaveBeenCalledWith(
      ORG,
      'agent',
      CHILD_AGENT,
      'token.delegated',
      `chain:${PARENT_AGENT}>${PARENT_AGENT}>${CHILD_AGENT}`,
      'allowed',
    );
  });

  it('rejects scopes that the parent does not cover', async () => {
    await expect(
      service.mint('parent-token', CHILD_AGENT, [
        { resource_type: 'secrets', resource_pattern: '*', allowed_actions: ['read'] },
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(tokenService.issueDelegatedToken).not.toHaveBeenCalled();
  });

  it('intersects actions with the parent scope', async () => {
    await service.mint('parent-token', CHILD_AGENT, [
      { resource_type: 'document', resource_pattern: 'docs/public/*', allowed_actions: ['read', 'delete'] },
    ]);
    const payload = tokenService.issueDelegatedToken.mock.calls[0][0];
    expect(payload.scopes[0].allowed_actions).toEqual(['read']);
  });

  it('blocks cross-org delegation', async () => {
    agentRepo.findOne.mockImplementation(async ({ where: { id } }: any) =>
      id === PARENT_AGENT ? parentAgent : { ...childAgent, org_id: 'other-org' },
    );
    await expect(service.mint('parent-token', CHILD_AGENT, request)).rejects.toThrow(ForbiddenException);
  });

  it('enforces max chain depth', async () => {
    delegationRepo.findOne.mockImplementation(async (q: any) =>
      q.where.child_jti
        ? ({ depth: 3, root_principal_type: 'user', root_principal_id: 'human-1' } as any)
        : null,
    );
    await expect(service.mint('parent-token', CHILD_AGENT, request)).rejects.toThrow(/chain too deep/);
  });

  it('carries the root principal across sub-delegation', async () => {
    delegationRepo.findOne.mockImplementation(async (q: any) =>
      q.where.child_jti
        ? ({ depth: 1, root_principal_type: 'user', root_principal_id: 'human-1' } as any)
        : null,
    );
    await service.mint('parent-token', CHILD_AGENT, request);
    const payload = tokenService.issueDelegatedToken.mock.calls[0][0];
    expect(payload.delegation).toMatchObject({ depth: 2, root_principal_type: 'user', root_principal_id: 'human-1' });
  });

  it('caps the child TTL at the parent remaining lifetime', async () => {
    tokenService.verifyToken.mockResolvedValue(
      parentPayload({ expires_at: new Date(Date.now() + 2 * 60_000) }),
    );
    await service.mint('parent-token', CHILD_AGENT, request, { ttlMinutes: 30 });
    const ttlMs = tokenService.issueDelegatedToken.mock.calls[0][2];
    expect(ttlMs).toBeLessThanOrEqual(2 * 60_000);
  });

  it('revokes a delegation and its child token', async () => {
    delegationRepo.findOne.mockResolvedValue({
      id: 'delegation-1',
      org_id: ORG,
      status: 'active',
      child_jti: 'child-jti-1',
    } as any);
    await service.revoke('delegation-1', ORG, 'compromise');
    expect(delegationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'revoked' }));
    expect(tokenService.revokeByJti).toHaveBeenCalledWith('child-jti-1');
  });

  it('refuses to revoke another org delegation', async () => {
    delegationRepo.findOne.mockResolvedValue({ id: 'delegation-1', org_id: 'other-org' } as any);
    await expect(service.revoke('delegation-1', ORG)).rejects.toThrow(ForbiddenException);
    expect(tokenService.revokeByJti).not.toHaveBeenCalled();
  });

  it('rejects an invalid parent token', async () => {
    tokenService.verifyToken.mockResolvedValue({ valid: false, reason: 'expired' });
    await expect(service.mint('bad', CHILD_AGENT, request)).rejects.toThrow(ForbiddenException);
  });

  describe('resolveRootAgentId', () => {
    it('walks an active chain up to the root agent', async () => {
      const childLink = { parent_jti: 'p1', parent_agent_id: 'child' } as any;
      const midLink = { parent_jti: 'p2', parent_agent_id: 'mid' } as any;
      delegationRepo.findOne.mockImplementation(async (q: any) =>
        q.where.child_jti === 'p1' ? midLink : null,
      );
      const root = await service.resolveRootAgentId(childLink);
      expect(root).toBe('mid');
    });

    it('returns the immediate parent when there is no higher link', async () => {
      const childLink = { parent_jti: 'p1', parent_agent_id: 'child' } as any;
      delegationRepo.findOne.mockResolvedValue(null);
      expect(await service.resolveRootAgentId(childLink)).toBe('child');
    });
  });
});
