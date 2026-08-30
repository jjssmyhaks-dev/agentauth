import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from '../../database/entities';

export interface PolicyContext {
  trigger: string;
  agent_id: string;
  org_id: string;
  agent_group_ids?: string[];
  current_trust_level?: string;
  session_mismatch?: boolean;
  new_environment?: boolean;
  resource_sensitivity?: string;
  off_hours?: boolean;
  current_hour?: number;
  [key: string]: any;
}

export interface PolicyEvaluationResult {
  matched: boolean;
  policy_id?: string;
  action: 'allow' | 'require_approval' | 'step_up' | 'deny';
  reason?: string;
}

@Injectable()
export class PolicyEngineService {
  private readonly logger = new Logger(PolicyEngineService.name);

  constructor(
    @InjectRepository(Policy)
    private policyRepo: Repository<Policy>,
  ) {}

  async evaluate(ctx: PolicyContext): Promise<PolicyEvaluationResult> {
    // Fetch all enabled policies for this org, ordered by scope specificity then priority
    const policies = await this.policyRepo.find({
      where: { org_id: ctx.org_id, enabled: true },
      order: { priority: 'DESC' },
    });

    // Filter to policies matching this trigger
    const matchingTrigger = policies.filter((p) => p.trigger === ctx.trigger);

    if (matchingTrigger.length === 0) {
      return { matched: false, action: 'allow' };
    }

    // Sort: most specific scope wins (agent > agent_group > org), then priority
    const sorted = matchingTrigger.sort((a, b) => {
      const scopeOrder: Record<string, number> = { agent: 3, agent_group: 2, org: 1 };
      const scopeDiff = (scopeOrder[a.scope] || 0) - (scopeOrder[b.scope] || 0);
      if (scopeDiff !== 0) return scopeDiff;
      return a.priority - b.priority;
    });

    for (const policy of sorted) {
      // Check scope match
      if (policy.scope === 'agent' && policy.scope_target_id !== ctx.agent_id) continue;
      if (policy.scope === 'agent_group' && (!ctx.agent_group_ids?.includes(policy.scope_target_id || ''))) continue;

      // Evaluate condition
      if (this.evaluateCondition(policy.condition, ctx)) {
        this.logger.log(`Policy ${policy.id} matched for agent ${ctx.agent_id}: ${policy.action}`);
        return {
          matched: true,
          policy_id: policy.id,
          action: policy.action,
          reason: `Policy "${policy.description || policy.id}" matched trigger "${policy.trigger}"`,
        };
      }
    }

    return { matched: false, action: 'allow' };
  }

  private evaluateCondition(condition: Record<string, any>, ctx: PolicyContext): boolean {
    if (!condition || Object.keys(condition).length === 0) return true;

    for (const [key, expectedValue] of Object.entries(condition)) {
      const actualValue = ctx[key];

      if (typeof expectedValue === 'object' && expectedValue !== null && !Array.isArray(expectedValue)) {
        // Nested condition: { trust_level: "questionable" }
        if (actualValue !== undefined && actualValue !== expectedValue) return false;
      } else if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(actualValue)) return false;
      } else {
        if (actualValue !== expectedValue) return false;
      }
    }

    return true;
  }

  async simulate(
    orgId: string,
    event: PolicyContext,
  ): Promise<{ would_fire: boolean; policies_checked: number; result: PolicyEvaluationResult }> {
    const policies = await this.policyRepo.find({
      where: { org_id: orgId, enabled: true },
    });

    const result = await this.evaluate({ ...event, org_id: orgId });

    return {
      would_fire: result.matched,
      policies_checked: policies.length,
      result,
    };
  }
}
