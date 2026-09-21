/**
 * Agent Treasury — agent-policy/1 schema validation.
 *
 * Binding rules (PRD §11.3): unknown fields are validation errors; `default`
 * must be "deny"; no regular expressions; amounts are decimal strings with an
 * asset; documents are canonicalized before hashing.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const EFFECTS = new Set(['allow', 'deny', 'require_approval', 'allow_with_cap']);
const CONDITION_FIELDS = new Set([
  'amount', 'asset', 'rail', 'counterparty', 'purpose', 'time',
  'velocity', 'task', 'environment', 'delegation_depth', 'root_principal_id',
]);
const TIME_UNITS = new Set(['1m', '5m', '15m', '1h', '6h', '24h', '7d', '30d']);
const DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const AMOUNT_OPS = new Set(['gt', 'gte', 'lt', 'lte']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkUnknownKeys(obj: Record<string, unknown>, allowed: Set<string>, path: string, errors: string[]): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) errors.push(`${path}: unknown field "${k}"`);
  }
}

function validateAmountCond(cond: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(cond)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  checkUnknownKeys(cond, AMOUNT_OPS, path, errors);
  if (Object.keys(cond).length === 0) errors.push(`${path}: empty amount condition`);
  for (const [op, spec] of Object.entries(cond)) {
    if (!isPlainObject(spec) || typeof spec.value !== 'string' || typeof spec.asset !== 'string') {
      errors.push(`${path}.${op}: must be { value: decimal string, asset: string }`);
      continue;
    }
    if (!/^\d+(\.\d+)?$/.test(spec.value)) {
      errors.push(`${path}.${op}.value: not a non-negative decimal string`);
    }
    if (!/^[A-Z]{3,8}$/.test(spec.asset)) {
      errors.push(`${path}.${op}.asset: invalid asset code`);
    }
  }
}

function validateCounterpartyCond(cond: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(cond)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  checkUnknownKeys(cond, new Set(['id', 'in_list', 'category', 'domain_suffix', 'allowlisted', 'denylisted']), path, errors);
  if (Object.keys(cond).length === 0) errors.push(`${path}: empty counterparty condition`);
  if (cond.category !== undefined) {
    if (!Array.isArray(cond.category) || cond.category.some((c) => typeof c !== 'string')) {
      errors.push(`${path}.category: must be a string array`);
    }
  }
  if (cond.allowlisted !== undefined && typeof cond.allowlisted !== 'boolean') {
    errors.push(`${path}.allowlisted: must be boolean`);
  }
  if (cond.denylisted !== undefined && typeof cond.denylisted !== 'boolean') {
    errors.push(`${path}.denylisted: must be boolean`);
  }
}

function validateTimeCond(cond: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(cond)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  checkUnknownKeys(cond, new Set(['allowed_hours', 'timezone', 'days']), path, errors);
  if (cond.allowed_hours !== undefined) {
    if (typeof cond.allowed_hours !== 'string' || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(cond.allowed_hours)) {
      errors.push(`${path}.allowed_hours: must be "HH:MM-HH:MM"`);
    }
  }
  if (cond.timezone !== undefined && typeof cond.timezone !== 'string') {
    errors.push(`${path}.timezone: must be a string`);
  }
  if (cond.days !== undefined) {
    if (!Array.isArray(cond.days) || cond.days.some((d) => !DAYS.has(d))) {
      errors.push(`${path}.days: must be a subset of [mon..sun]`);
    }
  }
}

function validateVelocityCond(cond: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(cond)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  checkUnknownKeys(cond, new Set(['window', 'max_count', 'max_amount']), path, errors);
  if (typeof cond.window !== 'string' || !TIME_UNITS.has(cond.window)) {
    errors.push(`${path}.window: must be one of ${[...TIME_UNITS].join('|')}`);
  }
  const hasCount = cond.max_count !== undefined;
  const hasAmount = cond.max_amount !== undefined;
  if (!hasCount && !hasAmount) {
    errors.push(`${path}: needs max_count or max_amount`);
  }
  if (hasCount && (typeof cond.max_count !== 'number' || cond.max_count < 1)) {
    errors.push(`${path}.max_count: must be a positive integer`);
  }
  if (hasAmount && !isPlainObject(cond.max_amount)) {
    errors.push(`${path}.max_amount: must be { value, asset }`);
  }
}

function validateRule(rule: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(rule)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  checkUnknownKeys(rule, new Set(['id', 'effect', 'when', 'reason', 'approval', 'cap']), path, errors);
  if (typeof rule.id !== 'string' || !rule.id) errors.push(`${path}.id: required string`);
  if (typeof rule.effect !== 'string' || !EFFECTS.has(rule.effect)) {
    errors.push(`${path}.effect: must be one of allow|deny|require_approval|allow_with_cap`);
  }
  if (rule.when !== undefined) {
    if (!isPlainObject(rule.when)) {
      errors.push(`${path}.when: must be an object`);
    } else {
      checkUnknownKeys(rule.when, CONDITION_FIELDS, `${path}.when`, errors);
      if (rule.when.amount !== undefined) validateAmountCond(rule.when.amount, `${path}.when.amount`, errors);
      if (rule.when.counterparty !== undefined) validateCounterpartyCond(rule.when.counterparty, `${path}.when.counterparty`, errors);
      if (rule.when.time !== undefined) validateTimeCond(rule.when.time, `${path}.when.time`, errors);
      if (rule.when.velocity !== undefined) validateVelocityCond(rule.when.velocity, `${path}.when.velocity`, errors);
      if (rule.when.rail !== undefined && (!Array.isArray(rule.when.rail) || rule.when.rail.some((r) => typeof r !== 'string'))) {
        errors.push(`${path}.when.rail: must be a string array`);
      }
      if (rule.when.asset !== undefined && (!Array.isArray(rule.when.asset) || rule.when.asset.some((a) => typeof a !== 'string'))) {
        errors.push(`${path}.when.asset: must be a string array`);
      }
      if (rule.when.purpose !== undefined && (!Array.isArray(rule.when.purpose) || rule.when.purpose.some((p) => typeof p !== 'string'))) {
        errors.push(`${path}.when.purpose: must be a string array`);
      }
      if (rule.when.task !== undefined && typeof rule.when.task !== 'string') {
        errors.push(`${path}.when.task: must be a string`);
      }
      if (rule.when.environment !== undefined && !['sandbox', 'live', undefined].includes(rule.when.environment as any)) {
        errors.push(`${path}.when.environment: must be "sandbox" or "live"`);
      }
      if (rule.when.delegation_depth !== undefined) {
        const d = rule.when.delegation_depth as any;
        if (!isPlainObject(d) || !('lte' in d) || typeof (d as any).lte !== 'number') {
          errors.push(`${path}.when.delegation_depth: must be { lte: number }`);
        }
      }
    }
  }
  if (rule.effect === 'require_approval') {
    const ap = rule.approval;
    if (!isPlainObject(ap)) {
      errors.push(`${path}.approval: required for require_approval rules`);
    } else {
      checkUnknownKeys(ap, new Set(['roles', 'quorum', 'timeout', 'separation_of_duties']), `${path}.approval`, errors);
      if (!Array.isArray(ap.roles) || ap.roles.some((r) => typeof r !== 'string')) {
        errors.push(`${path}.approval.roles: must be a string array`);
      }
      if (ap.quorum !== undefined && (typeof ap.quorum !== 'number' || ap.quorum < 1)) {
        errors.push(`${path}.approval.quorum: must be a positive integer`);
      }
      if (ap.timeout !== undefined && (typeof ap.timeout !== 'string' || !/^\d+(ms|s|m|h|d)$/.test(ap.timeout))) {
        errors.push(`${path}.approval.timeout: must be like "4h"`);
      }
    }
  }
  if (rule.effect === 'allow_with_cap') {
    const cap = rule.cap;
    if (!isPlainObject(cap) || typeof cap.value !== 'string' || typeof cap.asset !== 'string') {
      errors.push(`${path}.cap: required { value, asset } for allow_with_cap rules`);
    } else if (!/^\d+(\.\d+)?$/.test(cap.value)) {
      errors.push(`${path}.cap.value: not a non-negative decimal string`);
    }
  }
  if (typeof rule.reason !== 'undefined' && typeof rule.reason !== 'string') {
    errors.push(`${path}.reason: must be a string`);
  }
}

/** Validate an agent-policy/1 document. Unknown fields anywhere are errors. */
export function validatePolicyDocument(doc: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(doc)) {
    return { valid: false, errors: ['document: must be a JSON object'] };
  }
  checkUnknownKeys(doc, new Set(['schema', 'default', 'rules', 'time', 'limits']), 'document', errors);
  if (doc.schema !== 'agent-policy/1') errors.push('document.schema: must be "agent-policy/1"');
  if (doc.default !== 'deny') errors.push('document.default: must be "deny" (default deny is binding)');
  if (!Array.isArray(doc.rules)) {
    errors.push('document.rules: must be an array');
  } else {
    doc.rules.forEach((r, i) => validateRule(r, `document.rules[${i}]`, errors));
  }
  const ids = Array.isArray(doc.rules) ? doc.rules.map((r: any) => r?.id).filter(Boolean) : [];
  if (new Set(ids).size !== ids.length) errors.push('document.rules: duplicate rule ids');
  if (doc.time !== undefined) validateTimeCond(doc.time, 'document.time', errors);
  if (doc.limits !== undefined) {
    if (!isPlainObject(doc.limits)) {
      errors.push('document.limits: must be an object');
    } else {
      checkUnknownKeys(doc.limits, new Set(['per_transaction_max']), 'document.limits', errors);
      if (doc.limits.per_transaction_max !== undefined) {
        validateAmountCond({ lte: doc.limits.per_transaction_max }, 'document.limits.per_transaction_max', errors);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Canonical JSON: recursively sorted keys, stable serialization. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
