import { Injectable, Logger } from '@nestjs/common';
import { PolicyEngineService, PolicyContext, PolicyEvaluationResult } from './policy-engine.service';
import { WebhookEventsService } from '../webhooks/webhook-events.service';

export interface TriggerOutcome {
  trigger: string;
  fired: boolean;
  action: 'allow' | 'require_approval' | 'step_up' | 'deny';
  policy_id?: string;
  reason?: string;
}

/**
 * Async policy triggers. `permission_check` fires inline in the auth loop;
 * these four fire from detector sources — environment fingerprints, session
 * context verification, the trust scorer, and resource classification.
 *
 * Each method evaluates the matching policies and, when they decide
 * `deny`, emits the matching webhook event so consumers react in real time.
 */
@Injectable()
export class TriggerEmittersService {
  private readonly logger = new Logger(TriggerEmittersService.name);

  constructor(
    private policyEngine: PolicyEngineService,
    private webhookEvents: WebhookEventsService,
  ) {}

  private async decide(ctx: PolicyContext, eventType: string): Promise<TriggerOutcome> {
    let result: PolicyEvaluationResult;
    try {
      result = await this.policyEngine.evaluate(ctx);
    } catch (err) {
      // Detector failures must never break the caller's flow.
      this.logger.warn(`Trigger evaluation failed for ${ctx.trigger}: ${err}`);
      return { trigger: ctx.trigger, fired: false, action: 'allow' };
    }
    if (result.matched && result.action === 'deny') {
      try {
        await this.webhookEvents.emit(ctx.org_id, eventType, {
          policy_id: result.policy_id,
          reason: result.reason,
          agent_id: ctx.agent_id,
          ...ctx,
        });
      } catch (err) {
        this.logger.warn(`Webhook emission failed for ${ctx.trigger}: ${err}`);
      }
    }
    return {
      trigger: ctx.trigger,
      fired: result.matched,
      action: result.action,
      policy_id: result.policy_id,
      reason: result.reason,
    };
  }

  /** A previously-unseen environment fingerprint was observed for an agent. */
  async newEnvironment(orgId: string, agentId: string, fingerprintId: string, environmentInfo: Record<string, any>): Promise<TriggerOutcome> {
    return this.decide(
      {
        trigger: 'new_environment',
        agent_id: agentId,
        org_id: orgId,
        fingerprint_id: fingerprintId,
        environment_info: environmentInfo,
      },
      'policy.new_environment_denied',
    );
  }

  /** Session context no longer matches the recorded fingerprint. */
  async sessionMismatch(orgId: string, agentId: string, sessionId: string, mismatches: string[]): Promise<TriggerOutcome> {
    return this.decide(
      {
        trigger: 'session_mismatch',
        agent_id: agentId,
        org_id: orgId,
        session_id: sessionId,
        mismatches,
      },
      'policy.session_mismatch_denied',
    );
  }

  /** The trust scorer crossed a threshold downward for an agent. */
  async trustBelowThreshold(orgId: string, agentId: string, score: number, level: string): Promise<TriggerOutcome> {
    return this.decide(
      {
        trigger: 'trust_below_threshold',
        agent_id: agentId,
        org_id: orgId,
        trust_score: score,
        current_trust_level: level,
      },
      'policy.trust_denied',
    );
  }

  /** A request touched a resource classified above the sensitivity threshold. */
  async resourceSensitivity(orgId: string, agentId: string, resourceType: string, resourceId: string, sensitivity: string): Promise<TriggerOutcome> {
    return this.decide(
      {
        trigger: 'resource_sensitivity_high',
        agent_id: agentId,
        org_id: orgId,
        resource_type: resourceType,
        resource_id: resourceId,
        resource_sensitivity: sensitivity,
      },
      'policy.sensitivity_denied',
    );
  }
}
