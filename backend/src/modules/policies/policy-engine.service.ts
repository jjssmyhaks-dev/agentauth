import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from '../../database/entities';

/**
 * Contextual facts available to policy conditions. The permission-check flow
 * passes resource/action fields; simulate lets callers probe hypothetical
 * events. Unknown keys evaluate to `exists: false`.
 */
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
  // permission_check context
  resource_type?: string;
  resource_id?: string;
  action?: string;
  current_hour?: number;
  [key: string]: any;
}

/** An evaluated policy with its matched condition — used for audit + explain. */
export interface MatchedPolicy {
  policy_id: string;
  action: 'allow' | 'require_approval' | 'step_up' | 'deny';
  priority: number;
  reason: string;
}

export interface PolicyEvaluationResult {
  matched: boolean;
  policy_id?: string;
  action: 'allow' | 'require_approval' | 'step_up' | 'deny';
  reason?: string;
}

const TRUST_RANK: Record<string, number> = {
  untrusted: 0,
  questionable: 1,
  normal: 2,
  trusted: 3,
};

/** Operators usable inside a condition value: { field: { $gte: 2 } } */
const OPERATORS = ['$eq', '$ne', '$gte', '$lte', '$gt', '$lt', '$in', '$nin', '$exists'] as const;

function trustRank(level?: string): number | undefined {
  if (!level) return undefined;
  return TRUST_RANK[level];
}

/**
 * Evaluate one condition entry against the context. Conditions map context
 * fields to expected values; object values may use $operators. A field with
 * a value of `true` matches a truthy context field (shorthand for booleans).
 */
export function evaluateCondition(
  condition: Record<string, any>,
  ctx: Record<string, any>,
): boolean {
  if (!condition || Object.keys(condition).length === 0) return true;

  for (const [key, expected] of Object.entries(condition)) {
    const actual = ctx[key];

    if (expected === true) {
      if (!actual) return false;
      continue;
    }
    if (expected === false) {
      if (actual) return false;
      continue;
    }

    if (
      typeof expected === 'object' &&
      expected !== null &&
      !Array.isArray(expected) &&
      Object.keys(expected).some((k) => (OPERATORS as readonly string[]).includes(k))
    ) {
      for (const [op, operand] of Object.entries(expected)) {
        if (!applyOperator(op, operand, actual)) return false;
      }
      continue;
    }

    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
      continue;
    }

    if (actual !== expected) return false;
  }
  return true;
}

function applyOperator(op: string, operand: any, actual: any): boolean {
  switch (op) {
    case '$eq':
      return actual === operand;
    case '$ne':
      return actual !== operand;
    case '$gte':
      return rankOf(actual) !== undefined && rankOf(actual)! >= operand;
    case '$lte':
      return rankOf(actual) !== undefined && rankOf(actual)! <= operand;
    case '$gt':
      return rankOf(actual) !== undefined && rankOf(actual)! > operand;
    case '$lt':
      return rankOf(actual) !== undefined && rankOf(actual)! < operand;
    case '$in':
      return Array.isArray(operand) && operand.includes(actual);
    case '$nin':
      return Array.isArray(operand) && !operand.includes(actual);
    case '$exists':
      return operand ? actual !== undefined : actual === undefined;
    default:
      // Unknown operator: fail closed rather than silently matching.
      return false;
  }
}

/**
 * Numeric view of a context value for ordered comparisons. Trust levels map
 * to their rank (untrusted=0 … trusted=3); numbers pass through; anything
 * else is not orderable. `$gte`-style conditions on trust levels are the
 * primary use — e.g. { trust_rank: { $gte: 3 } }.
 */
function rankOf(value: any): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value in TRUST_RANK) return TRUST_RANK[value];
  return undefined;
}

@Injectable()
export class PolicyEngineService {
  private readonly logger = new Logger(PolicyEngineService.name);

  constructor(
    @InjectRepository(Policy)
    private policyRepo: Repository<Policy>,
  ) {}

  /**
   * All matching policies for this context, in deterministic evaluation
   * order: scope specificity (agent > agent_group > org), then priority
   * (DESC), then creation time (oldest first). The first match wins, so a
   * high-specificity or high-priority `deny` reliably overrides a broad
   * `allow`.
   */
  async evaluateAll(ctx: PolicyContext): Promise<MatchedPolicy[]> {
    const policies = await this.policyRepo.find({
      where: { org_id: ctx.org_id, enabled: true },
      order: { priority: 'DESC', created_at: 'ASC' },
    });

    const matchingTrigger = policies.filter((p) => p.trigger === ctx.trigger);

    const scopeOrder: Record<string, number> = { org: 0, agent_group: 1, agent: 2 };
    const sorted = matchingTrigger.sort((a, b) => {
      // Most specific scope first: agent > agent_group > org.
      const scopeDiff = (scopeOrder[b.scope] ?? 0) - (scopeOrder[a.scope] ?? 0);
      if (scopeDiff !== 0) return scopeDiff;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.created_at.getTime() - b.created_at.getTime();
    });

    const matched: MatchedPolicy[] = [];
    for (const policy of sorted) {
      if (policy.scope === 'agent' && policy.scope_target_id !== ctx.agent_id) continue;
      if (
        policy.scope === 'agent_group' &&
        !ctx.agent_group_ids?.includes(policy.scope_target_id || '')
      )
        continue;
      if (!evaluateCondition(policy.condition ?? {}, ctx)) continue;
      matched.push({
        policy_id: policy.id,
        action: policy.action,
        priority: policy.priority,
        reason: `Policy "${policy.description || policy.id}" matched trigger "${policy.trigger}"`,
      });
    }
    return matched;
  }

  async evaluate(ctx: PolicyContext): Promise<PolicyEvaluationResult> {
    const matched = await this.evaluateAll(ctx);
    if (matched.length === 0) return { matched: false, action: 'allow' };
    const first = matched[0];
    this.logger.log(`Policy ${first.policy_id} matched for agent ${ctx.agent_id}: ${first.action}`);
    return { matched: true, ...first };
  }

  async simulate(
    orgId: string,
    event: PolicyContext,
  ): Promise<{ would_fire: boolean; policies_checked: number; result: PolicyEvaluationResult; evaluated_order: MatchedPolicy[] }> {
    const policies = await this.policyRepo.find({
      where: { org_id: orgId, enabled: true },
    });
    const evaluatedOrder = await this.evaluateAll({ ...event, org_id: orgId });
    const first = evaluatedOrder[0];
    return {
      would_fire: evaluatedOrder.length > 0,
      policies_checked: policies.length,
      result: first
        ? { matched: true, ...first }
        : { matched: false, action: 'allow' },
      evaluated_order: evaluatedOrder,
    };
  }
}
