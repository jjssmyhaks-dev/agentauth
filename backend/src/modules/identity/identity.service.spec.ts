import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdentityService } from './identity.service';
import { Agent } from '../../database/entities';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('IdentityService', () => {
  let service: IdentityService;
  let repo: jest.Mocked<Repository<Agent>>;

  const mockAgent: Partial<Agent> = {
    id: 'test-agent-id',
    org_id: 'test-org-id',
    name: 'test-agent',
    public_key: 'test-public-key',
    status: 'active',
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityService,
        {
          provide: getRepositoryToken(Agent),
          useValue: {
            create: jest.fn().mockImplementation((data) => ({ ...mockAgent, ...data })),
            save: jest.fn().mockImplementation(async (data) => ({ ...mockAgent, ...data })),
            find: jest.fn().mockResolvedValue([mockAgent]),
            findOne: jest.fn().mockResolvedValue(mockAgent),
          },
        },
      ],
    }).compile();

    service = module.get<IdentityService>(IdentityService);
    repo = module.get(getRepositoryToken(Agent));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new agent', async () => {
      const result = await service.register('org-id', 'my-agent', 'pubkey');
      expect(result).toBeDefined();
      expect(result.name).toBe('my-agent');
      expect(repo.create).toHaveBeenCalledWith({
        org_id: 'org-id',
        name: 'my-agent',
        public_key: 'pubkey',
        status: 'active',
      });
    });
  });

  describe('findOne', () => {
    it('should return agent if found', async () => {
      const result = await service.findOne('test-agent-id');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if agent not found', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('revoke', () => {
    it('should revoke an active agent', async () => {
      const result = await service.revoke('test-agent-id');
      expect(result.status).toBe('revoked');
      expect(result.key_revoked_at).toBeDefined();
    });
  });

  describe('rotateKey', () => {
    it('should rotate key for active agent', async () => {
      // Reset to return active agent
      repo.findOne.mockResolvedValue({ ...mockAgent, status: 'active' } as Agent);
      const result = await service.rotateKey('test-agent-id', 'new-pubkey');
      expect(result.public_key).toBe('new-pubkey');
      expect(result.key_rotated_at).toBeDefined();
    });

    it('should throw for revoked agent', async () => {
      repo.findOne.mockResolvedValueOnce({ ...mockAgent, status: 'revoked' } as Agent);
      await expect(service.rotateKey('test-agent-id', 'new-key')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllByOrg', () => {
    it('should return agents for org', async () => {
      const result = await service.findAllByOrg('test-org-id');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
