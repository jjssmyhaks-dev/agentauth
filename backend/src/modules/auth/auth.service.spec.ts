import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ApiKey } from '../../database/entities';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let repo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; find: jest.Mock; update: jest.Mock };
  let storedKeys: Partial<ApiKey>[];

  /** Mimic the real repo: lookup by exact key_hash + status. */
  function seedFindOne() {
    repo.findOne.mockImplementation(({ where }: any) => {
      const row = storedKeys.find((k) => k.key_hash === where.key_hash && k.status === where.status);
      return Promise.resolve(row ?? null);
    });
  }

  const hashOf = (raw: string) => crypto.createHash('sha256').update(raw, 'utf8').digest('hex');

  beforeEach(async () => {
    storedKeys = [];
    repo = {
      create: jest.fn((x) => ({ id: 'key-new', created_at: new Date(), ...x })),
      save: jest.fn(async (k) => {
        storedKeys.unshift(k);
        return k;
      }),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: getRepositoryToken(ApiKey), useValue: repo }],
    }).compile();

    service = module.get(AuthService);
    seedFindOne();
  });

  it('creates a key and returns the raw value exactly once', async () => {
    const result = await service.createKey('org-1', 'ci', 'operator');
    expect(result.key).toMatch(/^ak_[0-9a-f]{48}$/);
    expect(result.prefix).toBe(result.key.substring(0, 12));
    // Stored hash must not be the raw key
    const stored = repo.create.mock.calls[0][0] as ApiKey;
    expect(stored.key_hash).not.toBe(result.key);
    expect(stored.key_hash).toBe(hashOf(result.key));
  });

  it('authenticates a raw key to its org and role', async () => {
    const created = await service.createKey('org-1', 'ci', 'auditor');
    storedKeys.push({ id: 'key-1', org_id: 'org-1', role: 'auditor', status: 'active', key_hash: hashOf(created.key) } as any);

    const ctx = await service.authenticate(created.key);
    expect(ctx.org_id).toBe('org-1');
    expect(ctx.role).toBe('auditor');
  });

  it('rejects malformed, unknown, and revoked keys identically', async () => {
    await expect(service.authenticate('')).rejects.toThrow(UnauthorizedException);
    await expect(service.authenticate('not-a-key')).rejects.toThrow(UnauthorizedException);

    await expect(service.authenticate('ak_ffffffff')).rejects.toThrow(UnauthorizedException);

    storedKeys.push({ id: 'k2', org_id: 'org-1', role: 'operator', status: 'revoked', key_hash: hashOf('ak_ffffffff') } as any);
    await expect(service.authenticate('ak_ffffffff')).rejects.toThrow(UnauthorizedException);
  });

  it('revokes keys scoped to the org', async () => {
    storedKeys.push({ id: 'key-1', org_id: 'org-1', status: 'active' } as any);
    repo.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(storedKeys.find((k) => k.id === where.id && k.org_id === where.org_id) ?? null),
    );
    await service.revokeKey('org-1', 'key-1');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'revoked' }));
  });

  it('refuses to revoke another org key', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.revokeKey('org-2', 'key-1')).rejects.toThrow(BadRequestException);
  });

  it('auditor role cannot mutate; admin and operator can', () => {
    expect(AuthService.canMutate('auditor')).toBe(false);
    expect(AuthService.canMutate('operator')).toBe(true);
    expect(AuthService.canMutate('admin')).toBe(true);
  });
});
