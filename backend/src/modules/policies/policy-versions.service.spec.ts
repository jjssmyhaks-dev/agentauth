import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PolicyVersion, Policy } from '../../database/entities';
import { PolicyVersionsService } from './policy-versions.service';

describe('PolicyVersionsService', () => {
  let service: PolicyVersionsService;
  let versionRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    manager: { getRepository: jest.Mock };
  };
  let policyRepo: { findOne: jest.Mock };

  const policy = (overrides: Partial<Policy> = {}): Policy =>
    ({
      id: 'pol-1',
      org_id: 'org-1',
      scope: 'org',
      scope_target_id: null,
      trigger: 'permission_check',
      condition: { action: 'delete' },
      action: 'deny',
      priority: 50,
      enabled: true,
      description: 'block deletes',
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
      organization: undefined as any,
      ...overrides,
    }) as Policy;

  beforeEach(async () => {
    policyRepo = { findOne: jest.fn() };
    versionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => ({ id: 'v-new', ...x })),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      manager: { getRepository: jest.fn(() => policyRepo) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyVersionsService,
        { provide: getRepositoryToken(PolicyVersion), useValue: versionRepo },
      ],
    }).compile();

    service = module.get(PolicyVersionsService);
  });

  it('records version 1 with empty diff on create', async () => {
    await service.record(policy(), 'created', null, 'admin@acme.com');

    expect(versionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        policy_id: 'pol-1',
        version: 1,
        diff: {},
        change_type: 'created',
        changed_by: 'admin@acme.com',
      }),
    );
    const snap = versionRepo.create.mock.calls[0][0].snapshot;
    expect(snap).toMatchObject({ action: 'deny', priority: 50, enabled: true });
    expect(versionRepo.save).toHaveBeenCalled();
  });

  it('records a field-level diff on update', async () => {
    versionRepo.findOne.mockResolvedValue({ version: 2 });
    const before = policy();
    const after = policy({ action: 'require_approval', priority: 60 });

    await service.record(after, 'updated', before, 'ops@acme.com');

    const args = versionRepo.create.mock.calls[0][0];
    expect(args.version).toBe(3);
    expect(args.diff).toEqual({
      action: { from: 'deny', to: 'require_approval' },
      priority: { from: 50, to: 60 },
    });
  });

  it('swallows persistence failures — history is best-effort', async () => {
    versionRepo.save.mockRejectedValue(new Error('disk full'));
    await expect(service.record(policy(), 'updated', policy(), null)).resolves.toBeUndefined();
  });

  it('lists versions newest first', async () => {
    await service.listForPolicy('pol-1');
    expect(versionRepo.find).toHaveBeenCalledWith({
      where: { policy_id: 'pol-1' },
      order: { version: 'DESC' },
    });
  });

  it('dry-run computes the diff without writing anything', async () => {
    policyRepo.findOne.mockResolvedValue(policy());

    const r = await service.dryRunDiff('pol-1', { action: 'allow', priority: 10 });

    expect(r.would_change).toBe(true);
    expect(r.changes).toEqual({
      action: { from: 'deny', to: 'allow' },
      priority: { from: 50, to: 10 },
    });
    expect(versionRepo.save).not.toHaveBeenCalled();
  });

  it('dry-run reports no change for identical candidates', async () => {
    policyRepo.findOne.mockResolvedValue(policy());
    const r = await service.dryRunDiff('pol-1', { action: 'deny' });
    expect(r.would_change).toBe(false);
    expect(r.changes).toEqual({});
  });

  it('dry-run 404s on a missing policy', async () => {
    policyRepo.findOne.mockResolvedValue(null);
    await expect(service.dryRunDiff('ghost', {})).rejects.toThrow(NotFoundException);
  });
});
