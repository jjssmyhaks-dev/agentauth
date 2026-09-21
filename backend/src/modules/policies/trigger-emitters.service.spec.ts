import { Test, TestingModule } from '@nestjs/testing';
import { PolicyEngineService } from './policy-engine.service';
import { WebhookEventsService } from '../webhooks/webhook-events.service';
import { TriggerEmittersService } from './trigger-emitters.service';

describe('TriggerEmittersService', () => {
  let service: TriggerEmittersService;
  let evaluate: jest.Mock;
  let emit: jest.Mock;

  beforeEach(async () => {
    evaluate = jest.fn().mockResolvedValue({ matched: false, action: 'allow' });
    emit = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriggerEmittersService,
        { provide: PolicyEngineService, useValue: { evaluate } },
        { provide: WebhookEventsService, useValue: { emit } },
      ],
    }).compile();

    service = module.get(TriggerEmittersService);
  });

  it('newEnvironment evaluates the new_environment trigger', async () => {
    await service.newEnvironment('org-1', 'agent-1', 'fp-1', { host: 'h1' });
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'new_environment', agent_id: 'agent-1', fingerprint_id: 'fp-1' }),
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits a webhook when the trigger denies', async () => {
    evaluate.mockResolvedValue({ matched: true, action: 'deny', policy_id: 'p-1', reason: 'nope' });
    const outcome = await service.sessionMismatch('org-1', 'agent-1', 'sess-1', ['source_ip_mismatch']);
    expect(outcome.fired).toBe(true);
    expect(outcome.action).toBe('deny');
    expect(emit).toHaveBeenCalledWith(
      'org-1',
      'policy.session_mismatch_denied',
      expect.objectContaining({ policy_id: 'p-1', session_id: 'sess-1' }),
    );
  });

  it('trustBelowThreshold passes score and level into the context', async () => {
    await service.trustBelowThreshold('org-1', 'agent-1', 15, 'untrusted');
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'trust_below_threshold', trust_score: 15, current_trust_level: 'untrusted' }),
    );
  });

  it('resourceSensitivity passes resource fields into the context', async () => {
    await service.resourceSensitivity('org-1', 'agent-1', 'database', 'prod-main', 'high');
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'resource_sensitivity_high', resource_type: 'database', resource_sensitivity: 'high' }),
    );
  });

  it('never throws when policy evaluation fails', async () => {
    evaluate.mockRejectedValue(new Error('engine down'));
    const outcome = await service.newEnvironment('org-1', 'agent-1', 'fp-1', {});
    expect(outcome.fired).toBe(false);
    expect(outcome.action).toBe('allow');
  });

  it('never throws when webhook emission fails on deny', async () => {
    evaluate.mockResolvedValue({ matched: true, action: 'deny', policy_id: 'p-1' });
    emit.mockRejectedValue(new Error('hook down'));
    await expect(
      service.trustBelowThreshold('org-1', 'agent-1', 10, 'untrusted'),
    ).resolves.toMatchObject({ action: 'deny' });
  });
});
