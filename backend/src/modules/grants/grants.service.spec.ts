import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrantsService } from './grants.service';
import { Grant, Agent } from '../../database/entities';
import { TokenService } from '../token/token.service';
import { IdentityService } from '../identity/identity.service';
import { NotFoundException } from '@nestjs/common';

describe('GrantsService', () => {
  let service: GrantsService;
  let grantRepo: jest.Mocked<Repository<Grant>>;
  let tokenService: jest.Mocked<TokenService>;
  let identityService: jest.Mocked<IdentityService>;

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
      ],
    }).compile();

    service = module.get<GrantsService>(GrantsService);
    grantRepo = module.get(getRepositoryToken(Grant));
    tokenService = module.get(TokenService);
    identityService = module.get(IdentityService);
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
