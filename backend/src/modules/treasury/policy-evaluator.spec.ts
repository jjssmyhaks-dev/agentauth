import { validatePolicyDocument, canonicalJson } from './policy-schema';
import { evaluatePolicy, PolicyContext } from './policy-evaluator';
import { toMinorUnits, fromMinorUnits } from './treasury-entities';

function ctx(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    amount_minor: '100',
    asset_code: 'USDC',
    rail: 'x402',
    environment: 'sandbox',
    counterparty: { identifier: 'api.example.com', domain_suffix: 'example.com', allowlisted: true, list: 'approved-apis', category: 'api_service' },
    purpose: 'market_data_lookup',
    task_ref: 'task_1',
    now: new Date('2026-09-21T10:00:00Z'),
    current_hour: 10,
    current_day: 'mon',
    velocity: { count: 0, amount_minor: '0' },
    ...overrides,
  };
}

const baseDoc = {
  schema: 'agent-policy/1',
  default: 'deny',
  rules: [
    {
      id: 'allow-small-approved',
      effect: 'allow',
      when: {
        rail: ['x402'],
        counterparty: { in_list: 'approved-apis' },
        amount: { lte: { value: '2.00', asset: 'USDC' } },
      },
    },
  ],
};

describe('policy-schema validation', () => {
  it('accepts a valid document', () => {
    expect(validatePolicyDocument(baseDoc)).toEqual({ valid: true, errors: [] });
  });

  it('rejects non-deny defaults (default deny is binding)', () => {
    const errors = validatePolicyDocument({ ...baseDoc, default: 'allow' }).errors;
    expect(errors.join(' ')).toMatch(/default/);
  });

  it('rejects unknown fields anywhere', () => {
    const errors = validatePolicyDocument({ ...baseDoc, mystery: 1 }).errors;
    expect(errors.join(' ')).toMatch(/unknown field "mystery"/);
  });

  it('rejects unknown rule fields', () => {
    const doc = { ...baseDoc, rules: [{ ...baseDoc.rules[0], regex: '.*' }] };
    expect(validatePolicyDocument(doc).errors.join(' ')).toMatch(/unknown field "regex"/);
  });

  it('rejects malformed amounts and bad effects', () => {
    const doc = {
      ...baseDoc,
      rules: [
        { id: 'a', effect: 'maybe', when: { amount: { lte: { value: 'abc', asset: 'USDC' } } } },
      ],
    };
    const errs = validatePolicyDocument(doc).errors;
    expect(errs.join(' ')).toMatch(/effect/);
    expect(errs.join(' ')).toMatch(/decimal/);
  });

  it('rejects duplicate rule ids and bad velocity windows', () => {
    const dup = { ...baseDoc, rules: [baseDoc.rules[0], baseDoc.rules[0]] };
    expect(validatePolicyDocument(dup).errors.join(' ')).toMatch(/duplicate/);

    const vel = {
      ...baseDoc,
      rules: [{ id: 'v', effect: 'allow', when: { velocity: { window: '2h' } } }],
    };
    expect(validatePolicyDocument(vel).errors.join(' ')).toMatch(/window/);
  });

  it('requires approval spec and cap on their effects', () => {
    const noApproval = { ...baseDoc, rules: [{ id: 'x', effect: 'require_approval', when: {} }] };
    expect(validatePolicyDocument(noApproval).errors.join(' ')).toMatch(/approval/);
    const noCap = { ...baseDoc, rules: [{ id: 'y', effect: 'allow_with_cap', when: {} }] };
    expect(validatePolicyDocument(noCap).errors.join(' ')).toMatch(/cap/);
  });

  it('canonicalJson is stable under key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } }))
      .toBe(canonicalJson({ a: { c: [3, { y: 2, z: 1 }], d: 2 }, b: 1 }));
  });
});

describe('policy evaluator', () => {
  it('allows when the single rule matches', () => {
    const d = evaluatePolicy(baseDoc, ctx({ amount_minor: toMinorUnits('1.50', 'USDC').toString() }));
    expect(d.effect).toBe('allow');
    expect(d.matched_rule_ids).toEqual(['allow-small-approved']);
  });

  it('denies by default when nothing matches', () => {
    const d = evaluatePolicy(baseDoc, ctx({ rail: 'card' }));
    expect(d.effect).toBe('deny');
    expect(d.reasons[0].code).toBe('policy_denied');
  });

  it('enforces amount bounds and never crosses assets (no implicit FX)', () => {
    const over = evaluatePolicy(baseDoc, ctx({ amount_minor: toMinorUnits('5.00', 'USDC').toString() }));
    expect(over.effect).toBe('deny');

    const cross = evaluatePolicy(baseDoc, ctx({ asset_code: 'INR', amount_minor: '100' }));
    expect(cross.effect).toBe('deny');
  });

  it('precedence: deny beats require_approval beats cap beats allow', () => {
    const doc = {
      schema: 'agent-policy/1',
      default: 'deny',
      rules: [
        { id: 'allow-all', effect: 'allow', when: {} },
        { id: 'cap', effect: 'allow_with_cap', when: {}, cap: { value: '0.50', asset: 'USDC' } },
        { id: 'need-human', effect: 'require_approval', when: {}, approval: { roles: ['finance'] } },
        { id: 'block', effect: 'deny', when: {} },
      ],
    };
    expect(evaluatePolicy(doc, ctx()).effect).toBe('deny');

    const withoutDeny = { ...doc, rules: doc.rules.slice(0, 3) };
    expect(evaluatePolicy(withoutDeny, ctx()).effect).toBe('require_approval');

    const withoutApproval = { ...doc, rules: doc.rules.slice(0, 2) };
    const capped = evaluatePolicy(withoutApproval, ctx({ amount_minor: '900' }));
    expect(capped.effect).toBe('allow_with_cap');
    // Cap binds only when it is BELOW the request; 500000 minor > 900, so the
    // effective cap is the request amount itself (cap never increases).
    expect(capped.cap_minor).toBe('900');
    const cappedOver = evaluatePolicy(withoutApproval, ctx({ amount_minor: toMinorUnits('2.00', 'USDC').toString() }));
    expect(cappedOver.cap_minor).toBe(toMinorUnits('0.50', 'USDC').toString());
  });

  it('allow_with_cap never increases the amount', () => {
    const doc = {
      schema: 'agent-policy/1', default: 'deny',
      rules: [{ id: 'cap', effect: 'allow_with_cap', when: {}, cap: { value: '50.00', asset: 'USDC' } }],
    };
    const d = evaluatePolicy(doc, ctx({ amount_minor: '10' })); // 0.000010? no — 10 minor units
    expect(d.effect).toBe('allow_with_cap');
    expect(BigInt(d.cap_minor!)).toBeLessThanOrEqual(10n);
  });

  it('deny-blocked-categories fires before an allow', () => {
    const doc = {
      schema: 'agent-policy/1', default: 'deny',
      rules: [
        { id: 'blocked', effect: 'deny', when: { counterparty: { category: ['gambling'] } } },
        { id: 'allow-all', effect: 'allow', when: {} },
      ],
    };
    const d = evaluatePolicy(doc, ctx({ counterparty: { identifier: 'casino.xyz', category: 'gambling' } }));
    expect(d.effect).toBe('deny');
    expect(d.matched_rule_ids).toContain('blocked');
  });

  it('velocity: count and amount windows gate allows', () => {
    const doc = {
      schema: 'agent-policy/1', default: 'deny',
      rules: [{
        id: 'rate', effect: 'allow',
        when: { velocity: { window: '1h', max_count: 10, max_amount: { value: '100.00', asset: 'USDC' } } },
      }],
    };
    expect(evaluatePolicy(doc, ctx({ velocity: { count: 9, amount_minor: '0' } })).effect).toBe('allow');
    expect(evaluatePolicy(doc, ctx({ velocity: { count: 10, amount_minor: '0' } })).effect).toBe('deny');
    expect(evaluatePolicy(doc, ctx({ velocity: { count: 1, amount_minor: toMinorUnits('100.00', 'USDC').toString() } })).effect).toBe('deny');
  });

  it('time windows with days gate everything (global)', () => {
    const doc = {
      ...baseDoc,
      time: { allowed_hours: '09:00-19:00', timezone: 'Asia/Kolkata', days: ['mon', 'tue'] },
    };
    expect(evaluatePolicy(doc, ctx({ current_hour: 10, current_day: 'mon' })).effect).toBe('allow');
    const night = evaluatePolicy(doc, ctx({ current_hour: 22, current_day: 'mon' }));
    expect(night.effect).toBe('deny');
    expect(night.reasons[0].code).toBe('outside_allowed_hours');
    const sunday = evaluatePolicy(doc, ctx({ current_hour: 10, current_day: 'sun' }));
    expect(sunday.effect).toBe('deny');
  });

  it('global per-transaction maximum denies above the cap', () => {
    const doc = {
      ...baseDoc,
      limits: { per_transaction_max: { value: '1.00', asset: 'USDC' } },
    };
    const d = evaluatePolicy(doc, ctx({ amount_minor: toMinorUnits('2.00', 'USDC').toString() }));
    expect(d.effect).toBe('deny');
  });

  it('counterparty domain_suffix and allowlisted conditions match', () => {
    const doc = {
      schema: 'agent-policy/1', default: 'deny',
      rules: [{ id: 'vendor', effect: 'allow', when: { counterparty: { domain_suffix: 'example.com', allowlisted: true } } }],
    };
    expect(evaluatePolicy(doc, ctx()).effect).toBe('allow');
    expect(evaluatePolicy(doc, ctx({ counterparty: { identifier: 'x.other.org', domain_suffix: 'other.org' } })).effect).toBe('deny');
  });

  it('fails closed on a corrupted document (validated inside evaluate)', () => {
    const broken: any = { schema: 'agent-policy/1', default: 'allow', rules: [] };
    const d = evaluatePolicy(broken, ctx());
    expect(d.effect).toBe('deny');
    expect(d.reasons[0].code).toBe('policy_error');
  });

  it('require_approval carries roles, quorum and SoD through', () => {
    const doc = {
      schema: 'agent-policy/1', default: 'deny',
      rules: [{
        id: 'big', effect: 'require_approval',
        when: { amount: { gt: { value: '5000.00', asset: 'INR' } } },
        approval: { roles: ['finance'], quorum: 2, timeout: '4h', separation_of_duties: true },
      }],
    };
    const d = evaluatePolicy(doc, ctx({
      asset_code: 'INR',
      amount_minor: toMinorUnits('6000.00', 'INR').toString(),
      rail: 'manual',
    }));
    expect(d.effect).toBe('require_approval');
    expect(d.approval).toMatchObject({ roles: ['finance'], quorum: 2, separation_of_duties: true });
  });

  it('minor-unit conversion round-trips', () => {
    expect(fromMinorUnits(toMinorUnits('1234.56', 'INR'), 'INR')).toBe('1234.56');
    expect(fromMinorUnits(toMinorUnits('0.750000', 'USDC'), 'USDC')).toBe('0.750000');
    expect(toMinorUnits('2.00', 'USDC')).toBe(2000000n);
  });
});
