/**
 * Agent Treasury — pure policy evaluator (agent-policy/1).
 *
 * DETERMINISTIC BY CONSTRUCTION (PRD design principle 1 and §9.3): no I/O,
 * no network, no clock reads beyond the caller-supplied context, no LLM.
 * Everything the evaluator needs arrives in `context`; callers (the
 * orchestrator) are responsible for assembling it and for enforcing the
 * steps around evaluation (kill switch, mandate, budgets).
 *
 * Fail closed: any internal error evaluating a rule is treated as a non-match
 * is FALSE — an error while evaluating bubbles as a `deny` decision with
 * reason `policy_error` (never `allow`).
 */
import { canonicalJson, validatePolicyDocument } from './policy-schema';
import { toMinorUnits } from './treasury-entities';

export interface PolicyContext {
  amount_minor: string;          // decimal string of minor units
  asset_code: string;
  rail: string;
  environment: 'sandbox' | 'live';
  counterparty: {
    id?: string;
    identifier: string;
    kind?: string;
    category?: string | null;
    domain_suffix?: string;      // precomputed last-label+1 of identifier
    allowlisted?: boolean;
    denylisted?: boolean;
    /** membership list name this counterparty belongs to (e.g. "approved-apis") */
    list?: string;
  };
  purpose?: string | null;
  task_ref?: string | null;
  now: Date;                     // injected clock (no Date.now() in the evaluator)
  current_hour: number;          // caller computes in policy timezone
  current_day: string;           // 'mon'..'sun', caller computes
  velocity: { count: number; amount_minor: string }; // caller-derived for the rule's window
  delegation_depth?: number;
  root_principal_id?: string | null;
}

export interface DecisionReason {
  rule_id?: string;
  code?: string;
  message: string;
}

export interface PolicyDecision {
  effect: 'allow' | 'deny' | 'require_approval' | 'allow_with_cap';
  reasons: DecisionReason[];
  matched_rule_ids: string[];
  cap_minor: string | null;
  cap_asset: string | null;
  approval?: { roles: string[]; quorum: number; timeout?: string; separation_of_duties?: boolean } | null;
}

const DENY = (reasons: DecisionReason[]): PolicyDecision => ({
  effect: 'deny', reasons, matched_rule_ids: [], cap_minor: null, cap_asset: null, approval: null,
});

/** Precedence (binding §11.2): deny > require_approval > allow_with_cap > allow. */
const PRECEDENCE: Record<string, number> = {
  deny: 4, require_approval: 3, allow_with_cap: 2, allow: 1,
};

function amountMatches(cond: any, ctxAmountMinor: string, ctxAsset: string): boolean {
  for (const [op, spec] of Object.entries(cond as Record<string, any>)) {
    const { value, asset } = spec as { value: string; asset: string };
    // No implicit FX: an INR bound never matches a USDC intent.
    if (asset !== ctxAsset) return false;
    const bound = toMinorUnits(value, asset);
    const amount = BigInt(ctxAmountMinor);
    const ok =
      (op === 'gt' && amount > bound) ||
      (op === 'gte' && amount >= bound) ||
      (op === 'lt' && amount < bound) ||
      (op === 'lte' && amount <= bound);
    if (!ok) return false;
  }
  return true;
}

function counterpartyMatches(cond: any, ctx: PolicyContext): boolean {
  const c = ctx.counterparty ?? ({} as PolicyContext['counterparty']);
  if (cond.id !== undefined && cond.id !== c.id) return false;
  if (cond.in_list !== undefined && cond.in_list !== (c as any).list) return false;
  if (cond.category !== undefined) {
    if (!c.category || !(cond.category as string[]).includes(c.category)) return false;
  }
  if (cond.domain_suffix !== undefined) {
    if (!c.domain_suffix || !(c.domain_suffix as string).endsWith(cond.domain_suffix)) return false;
  }
  if (cond.allowlisted !== undefined && !!c.allowlisted !== !!cond.allowlisted) return false;
  if (cond.denylisted !== undefined && !!c.denylisted !== !!cond.denylisted) return false;
  return true;
}

function timeMatches(cond: any, ctx: PolicyContext): boolean {
  if (cond.allowed_hours !== undefined) {
    const [from, to] = (cond.allowed_hours as string).split('-');
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    const mins = ctx.current_hour * 60 + Math.floor((ctx.now.getSeconds() / 60));
    if (mins < fh * 60 + fm || mins >= th * 60 + tm) return false;
  }
  if (cond.days !== undefined && !(cond.days as string[]).includes(ctx.current_day)) return false;
  return true;
}

function velocityMatches(cond: any, ctx: PolicyContext): boolean {
  const v = ctx.velocity ?? { count: 0, amount_minor: '0' };
  if (cond.max_count !== undefined && v.count >= (cond.max_count as number)) return false;
  if (cond.max_amount !== undefined) {
    const { value, asset } = cond.max_amount as { value: string; asset: string };
    if (asset === ctx.asset_code && BigInt(v.amount_minor) >= toMinorUnits(value, asset)) return false;
  }
  return true;
}

function ruleMatches(when: Record<string, any>, ctx: PolicyContext): boolean {
  if (when.amount !== undefined && !amountMatches(when.amount, ctx.amount_minor, ctx.asset_code)) return false;
  if (when.rail !== undefined && !(when.rail as string[]).includes(ctx.rail)) return false;
  if (when.asset !== undefined && !(when.asset as string[]).includes(ctx.asset_code)) return false;
  if (when.counterparty !== undefined && !counterpartyMatches(when.counterparty, ctx)) return false;
  if (when.purpose !== undefined) {
    if (!ctx.purpose || !(when.purpose as string[]).includes(ctx.purpose)) return false;
  }
  if (when.task !== undefined && when.task !== ctx.task_ref) return false;
  if (when.environment !== undefined && when.environment !== ctx.environment) return false;
  if (when.time !== undefined && !timeMatches(when.time, ctx)) return false;
  if (when.velocity !== undefined && !velocityMatches(when.velocity, ctx)) return false;
  if (when.delegation_depth !== undefined && (ctx.delegation_depth ?? 0) > (when.delegation_depth as any).lte) return false;
  if (when.root_principal_id !== undefined && when.root_principal_id !== ctx.root_principal_id) return false;
  return true;
}

/**
 * Evaluate a validated agent-policy/1 document against a context.
 * Evaluation order inside the document: global time → global per-txn limit →
 * rules in document order (collect all matches) → precedence resolution →
 * default deny.
 */
export function evaluatePolicy(doc: Record<string, any>, ctx: PolicyContext): PolicyDecision {
  // Fail closed on structurally invalid documents even if a caller skips validation.
  const validation = validatePolicyDocument(doc);
  if (!validation.valid) {
    return DENY([{ code: 'policy_error', message: `Invalid policy document: ${validation.errors[0]}` }]);
  }

  // 1. Global time window.
  if (doc.time !== undefined && !timeMatches(doc.time, ctx)) {
    return DENY([{ code: 'outside_allowed_hours', message: 'Outside the policy allowed time window' }]);
  }

  // 2. Global per-transaction limit.
  const globalMax = (doc.limits as any)?.per_transaction_max;
  if (globalMax) {
    if (!amountMatches({ lte: globalMax }, ctx.amount_minor, ctx.asset_code)) {
      return DENY([{ code: 'policy_denied', message: 'Amount exceeds the policy per-transaction maximum' }]);
    }
  }

  // 3. Rules in document order; collect ALL matches.
  const matched: Array<{ rule: any; effect: string }> = [];
  for (const rule of doc.rules as any[]) {
    try {
      if (ruleMatches(rule.when ?? {}, ctx)) matched.push({ rule, effect: rule.effect });
    } catch (err) {
      // Any error inside rule matching fails closed for the whole decision.
      return DENY([{ code: 'policy_error', message: `Rule "${rule?.id}" failed evaluation` }]);
    }
  }

  if (matched.length === 0) {
    return DENY([{ code: 'policy_denied', message: 'No policy rule matched (default deny)' }]);
  }

  // 4. Precedence resolution; ties broken by document order (first wins).
  let winner = matched[0];
  for (const m of matched) {
    if (PRECEDENCE[m.effect] > PRECEDENCE[winner.effect]) winner = m;
  }

  const reasons: DecisionReason[] = [
    { rule_id: winner.rule.id, message: winner.rule.reason ?? `Matched rule "${winner.rule.id}"` },
  ];

  if (winner.effect === 'allow_with_cap') {
    const cap = toMinorUnits(winner.rule.cap.value, winner.rule.cap.asset);
    // Cross-asset cap can never bind (no FX) — treat as full allow.
    const effectiveCap =
      winner.rule.cap.asset === ctx.asset_code && cap < BigInt(ctx.amount_minor) ? cap.toString() : ctx.amount_minor;
    return {
      effect: 'allow_with_cap' as const,
      reasons,
      matched_rule_ids: matched.map((m) => m.rule.id),
      cap_minor: effectiveCap,
      cap_asset: ctx.asset_code,
      approval: null,
    };
  }

  if (winner.effect === 'require_approval') {
    return {
      effect: 'require_approval' as const,
      reasons,
      matched_rule_ids: matched.map((m) => m.rule.id),
      cap_minor: null,
      cap_asset: null,
      approval: {
        roles: winner.rule.approval.roles,
        quorum: winner.rule.approval.quorum ?? 1,
        timeout: winner.rule.approval.timeout,
        separation_of_duties: winner.rule.approval.separation_of_duties ?? false,
      },
    };
  }

  return {
    effect: winner.effect as PolicyDecision['effect'],
    reasons,
    matched_rule_ids: matched.map((m) => m.rule.id),
    cap_minor: null,
    cap_asset: null,
    approval: null,
  };
}

/** Canonical checksum of a policy document (sorted-key JSON, sha256 by caller). */
export function policyChecksum(doc: Record<string, any>): string {
  return canonicalJson(doc);
}
