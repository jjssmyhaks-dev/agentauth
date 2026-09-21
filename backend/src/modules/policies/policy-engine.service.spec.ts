import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PolicyEngineService, evaluateCondition, PolicyContext } from './policy-engine.service';
import { Policy } from '../../database/entities';
import { GroupsService } from '../groups/groups.service';
import { WebhookEventsService } from '../webhooks/webhook-events.service';

function makePolicy(overrides: Partial<Policy> & { id: string }): Policy {
  const base: Policy = {
    id: overrides.id,
    org_id: 'org-1',
    scope: 'org',
    scope_target_id: null,
    trigger: 'permission_check',
    condition: {},
    action: 'allow',
    priority: 0,
    enabled: true,
    description: '',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    organization: undefined as any,
  };
  return Object.assign(base, overrides) as Policy;
}

function baseCtx(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    trigger: 'permission_check',
    agent_id: 'agent-1',
    org_id: 'org-1',
    action: 'read',
    resource_type: 'document',
    resource_id: 'doc-1',
    ...overrides,
  };
}

describe('evaluateCondition', () => {
  it('matches empty conditions (catch-all)', () => {
    expect(evaluateCondition({}, { any: 'thing' })).toBe(true);
  });

  it('matches boolean shorthand', () => {
    expect(evaluateCondition({ off_hours: true }, { off_hours: true })).toBe(true);
    expect(evaluateCondition({ off_hours: true }, { off_hours: false })).toBe(false);
    expect(evaluateCondition({ session_mismatch: false }, {})).toBe(true);
    expect(evaluateCondition({ session_mismatch: false }, { session_mismatch: true })).toBe(false);
  });

  it('matches plain equality and arrays ($in shorthand)', () => {
    expect(evaluateCondition({ action: 'read' }, { action: 'read' })).toBe(true);
    expect(evaluateCondition({ action: 'read' }, { action: 'write' })).toBe(false);
    expect(evaluateCondition({ action: ['read', 'write'] }, { action: 'write' })).toBe(true);
    expect(evaluateCondition({ action: ['read', 'write'] }, { action: 'delete' })).toBe(false);
  });

  it('supports $gte/$lte on trust levels via rank', () => {
    expect(evaluateCondition({ trust_rank: { $gte: 3 } }, { trust_rank: 3 })).toBe(true);
    // trust_rank derived from current_trust_level
    expect(evaluateCondition({ current_trust_level: { $gte: 3 } }, { current_trust_level: 'trusted' })).toBe(true);
    expect(evaluateCondition({ current_trust_level: { $gte: 3 } }, { current_trust_level: 'normal' })).toBe(false);
    expect(evaluateCondition({ current_trust_level: { $lte: 1 } }, { current_trust_level: 'questionable' })).toBe(true);
  });

  it('supports $in / $nin / $ne / $exists', () => {
    expect(evaluateCondition({ resource_type: { $in: ['document', 'email'] } }, { resource_type: 'email' })).toBe(true);
    expect(evaluateCondition({ resource_type: { $nin: ['secret'] } }, { resource_type: 'document' })).toBe(true);
    expect(evaluateCondition({ resource_type: { $nin: ['secret'] } }, { resource_type: 'secret' })).toBe(false);
    expect(evaluateCondition({ action: { $ne: 'delete' } }, { action: 'read' })).toBe(true);
    expect(evaluateCondition({ off_hours: { $exists: true } }, { off_hours: true })).toBe(true);
    expect(evaluateCondition({ off_hours: { $exists: true } }, {})).toBe(false);
  });

  it('fails closed on unknown operators', () => {
    expect(evaluateCondition({ action: { $regex: '.*' } }, { action: 'read' })).toBe(false);
  });
});

describe('PolicyEngineService', () => {
  let service: PolicyEngineService;
  let policies: Policy[];
  let groupIdsForAgent: jest.Mock;
  let emit: jest.Mock;

  const repoMock = {
    find: jest.fn(async (opts?: any) => {
      let rows = policies.filter((p) => p.enabled);
      if (opts?.where?.org_id) rows = rows.filter((p) => p.org_id === opts.where.org_id);
      return [...rows].sort((a, b) => b.priority - a.priority);
    }),
  };

  beforeEach(async () => {
    groupIdsForAgent = jest.fn().mockResolvedValue(['group-1']);
    emit = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEngineService,
        { provide: getRepositoryToken(Policy), useValue: repoMock },
        { provide: GroupsService, useValue: { groupIdsForAgent } },
        { provide: WebhookEventsService, useValue: { emit } },
      ],
    }).compile();
    service = module.get(PolicyEngineService);
  });

  it('returns allow when no policy matches the trigger', async () => {
    policies = [];
    const r = await service.evaluate(baseCtx());
    expect(r).toEqual({ matched: false, action: 'allow' });
  });

  it('agent-scoped policy beats org-scoped at equal priority', async () => {
    policies = [
      makePolicy({ id: 'p-org', action: 'deny', scope: 'org', priority: 5 }),
      makePolicy({ id: 'p-agent', action: 'allow', scope: 'agent', scope_target_id: 'agent-1', priority: 5 }),
    ];
    const r = await service.evaluate(baseCtx());
    expect(r.matched).toBe(true);
    expect(r.policy_id).toBe('p-agent');
  });

  it('higher priority wins within the same scope', async () => {
    policies = [
      makePolicy({ id: 'p-low', action: 'allow', priority: 1 }),
      makePolicy({ id: 'p-high', action: 'deny', priority: 9 }),
    ];
    const r = await service.evaluate(baseCtx());
    expect(r.policy_id).toBe('p-high');
    expect(r.action).toBe('deny');
  });

  it('first match wins → a deny earlier in the order blocks later allows', async () => {
    policies = [
      makePolicy({ id: 'p-deny', action: 'deny', priority: 5, condition: { action: 'delete' } }),
      makePolicy({ id: 'p-allow', action: 'allow', priority: 5 }),
    ];
    const denied = await service.evaluate(baseCtx({ action: 'delete' }));
    expect(denied.action).toBe('deny');
    const allowed = await service.evaluate(baseCtx({ action: 'read' }));
    expect(allowed.policy_id).toBe('p-allow');
  });

  it('skips disabled policies and other agents', async () => {
    policies = [
      makePolicy({ id: 'p-other-agent', scope: 'agent', scope_target_id: 'agent-999', action: 'deny' }),
      makePolicy({ id: 'p-disabled', enabled: false, action: 'deny' }),
    ];
    const r = await service.evaluate(baseCtx());
    expect(r.matched).toBe(false);
  });

  it('skips agent-scoped policies whose condition does not match', async () => {
    policies = [
      makePolicy({ id: 'p-cond', scope: 'agent', scope_target_id: 'agent-1', action: 'deny', condition: { action: 'delete' } }),
    ];
    const r = await service.evaluate(baseCtx({ action: 'read' }));
    expect(r.matched).toBe(false);
  });

  it('simulate reports the full evaluation order', async () => {
    policies = [
      makePolicy({ id: 'p-1', action: 'allow', priority: 3 }),
      makePolicy({ id: 'p-2', action: 'deny', priority: 3, condition: { action: 'delete' } }),
    ];
    const r = await service.simulate('org-1', baseCtx());
    expect(r.policies_checked).toBe(2);
    expect(r.result.matched).toBe(true);
    expect(r.result.policy_id).toBe('p-1');
    expect(r.evaluated_order).toHaveLength(1);
  });

  it('matches agent_group-scoped policies when the agent is a member', async () => {
    policies = [
      makePolicy({ id: 'p-group', scope: 'agent_group', scope_target_id: 'group-1', action: 'deny' }),
      makePolicy({ id: 'p-org', action: 'allow', priority: 5 }),
    ];
    const r = await service.evaluate(baseCtx());
    expect(r.policy_id).toBe('p-group');
    // Memberships resolved lazily, only because a group-scoped policy exists.
    expect(groupIdsForAgent).toHaveBeenCalledWith('org-1', 'agent-1');
  });

  it('group-scoped policy is skipped when the agent is not a member', async () => {
    groupIdsForAgent.mockResolvedValue([]);
    policies = [
      makePolicy({ id: 'p-group', scope: 'agent_group', scope_target_id: 'group-1', action: 'deny' }),
    ];
    const r = await service.evaluate(baseCtx());
    expect(r.matched).toBe(false);
  });

  it('does not resolve group memberships unless a group-scoped policy exists', async () => {
    policies = [makePolicy({ id: 'p-org', action: 'allow' })];
    await service.evaluate(baseCtx());
    expect(groupIdsForAgent).not.toHaveBeenCalled();
  });

  it('evaluation still proceeds when the membership lookup fails', async () => {
    groupIdsForAgent.mockRejectedValue(new Error('groups down'));
    policies = [
      makePolicy({ id: 'p-group', scope: 'agent_group', scope_target_id: 'group-1', action: 'deny' }),
      makePolicy({ id: 'p-org', action: 'allow', priority: 1 }),
    ];
    const r = await service.evaluate(baseCtx());
    // Lookup failed → no membership known → group policy skipped, org policy wins.
    expect(r.policy_id).toBe('p-org');
  });

  it('emits policy.denied when a live permission check is denied', async () => {
    policies = [makePolicy({ id: 'p-deny', action: 'deny' })];
    await service.evaluate(baseCtx({ resource_type: 'database', resource_id: 'prod-1' }));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      'org-1',
      'policy.denied',
      expect.objectContaining({ policy_id: 'p-deny', resource_type: 'database', resource_id: 'prod-1' }),
    );
  });

  it('does not emit policy.denied for allows or simulations', async () => {
    policies = [makePolicy({ id: 'p-allow', action: 'allow' })];
    await service.evaluate(baseCtx());
    policies = [makePolicy({ id: 'p-deny', action: 'deny' })];
    await service.simulate('org-1', baseCtx());
    expect(emit).not.toHaveBeenCalled();
  });

  it('a webhook emission failure never changes the decision', async () => {
    policies = [makePolicy({ id: 'p-deny', action: 'deny' })];
    emit.mockRejectedValue(new Error('webhook endpoint on fire'));
    const r = await service.evaluate(baseCtx());
    expect(r.action).toBe('deny');
    expect(r.policy_id).toBe('p-deny');
  });
});
