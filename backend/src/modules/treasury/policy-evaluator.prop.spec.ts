/**
 * Property-based tests for the pure policy evaluator (fast-check).
 *
 * These complement the example-based spec by asserting INVARIANTS that must
 * hold for every generated input — the PRD's determinism and fail-closed
 * guarantees are properties, not examples:
 *   P1  deny > require_approval > allow_with_cap > allow, always.
 *   P2  A doc with no matching rules denies (default deny).
 *   P3  Empty docs deny (nothing can be granted by an empty policy).
 *   P4  Any amount condition the schema accepts can never be violated by the
 *       decision it gates (bound direction respected).
 *   P5  Global per_transaction_max: amounts above it never allow.
 *   P6  Unmatched-condition rules never widen the decision.
 *   P7  Structural mutations a hostile tenant might make are rejected by the
 *       schema (unknown fields are errors, never silently ignored).
 *   P8  canonicalJson is key-order independent and round-trips objects.
 */
import fc from 'fast-check';
import { evaluatePolicy, type PolicyContext } from './policy-evaluator';
import { validatePolicyDocument, canonicalJson } from './policy-schema';

const EFFECTS = ['allow', 'deny', 'require_approval', 'allow_with_cap'] as const;
type Effect = (typeof EFFECTS)[number];

/** Rank per binding §11.2 precedence. */
const RANK: Record<Effect, number> = { deny: 4, require_approval: 3, allow_with_cap: 2, allow: 1 };

const baseContext: PolicyContext = {
  amount_minor: '750000', // 0.75 USDC
  asset_code: 'USDC',
  rail: 'x402',
  environment: 'sandbox',
  counterparty: { identifier: 'api.example.com', category: 'api', list: 'approved-apis' },
  purpose: 'market_data_lookup',
  task_ref: null,
  now: new Date('2026-09-22T12:00:00Z'),
  current_hour: 12,
  current_day: 'tue',
  velocity: { count: 0, amount_minor: '0' },
};

function ctxWith(overrides: Partial<PolicyContext>): PolicyContext {
  return { ...baseContext, ...overrides, counterparty: { ...baseContext.counterparty, ...(overrides.counterparty ?? {}) } };
}

/** A rule that matches the base context unconditionally except for its effect. */
function unconditional(effect: Effect, id = `r-${effect}`) {
  const rule: Record<string, unknown> = { id, effect };
  if (effect === 'allow_with_cap') rule.cap = { value: '100.00', asset: 'USDC' };
  if (effect === 'require_approval') rule.approval = { roles: ['admin'], quorum: 1 };
  return rule;
}

function docWith(rules: Array<Record<string, unknown>>) {
  return { schema: 'agent-policy/1', default: 'deny', rules };
}

// ── Arbitraries ─────────────────────────────────────────────────────────────

/** Non-empty arrays of distinct valid rules, in generated order. */
const rulesArb = fc
  .array(fc.constantFrom(...EFFECTS), { minLength: 1, maxLength: 5 })
  .map((effects) => {
    const seen = new Set<string>();
    return effects.map((e, i) => {
      let id = `r-${e}-${i}`;
      while (seen.has(id)) id = `${id}-x`; // schema rejects duplicate ids
      seen.add(id);
      return unconditional(e, id);
    });
  });

// ── P1: precedence is a total order, for every doc and every context ────────

describe('property: precedence (P1)', () => {
  it('winner effect always has the maximal rank among matching rules', () => {
    const ctxArb = fc.constantFrom(
      ctxWith({}),
      ctxWith({ amount_minor: '5000000' }), // 5 USDC — above the unconditional cap
      ctxWith({ purpose: null }),
    );
    fc.assert(
      fc.property(rulesArb, ctxArb, (rules, ctx) => {
        const d = evaluatePolicy(docWith(rules), ctx);
        const expectedRank = Math.max(...rules.map((r) => RANK[r.effect as Effect]));
        expect(RANK[d.effect]).toBe(expectedRank);
        // matched_rule_ids must include every matching rule
        expect(d.matched_rule_ids.length).toBe(rules.length);
      }),
      { numRuns: 300 },
    );
  });

  it('ties resolve to the first matching rule in document order', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EFFECTS),
        fc.constantFrom(...EFFECTS),
        (e1, e2) => {
          const d = evaluatePolicy(docWith([unconditional(e1, 'first'), unconditional(e2, 'second')]), ctxWith({}));
          expect(RANK[d.effect]).toBe(Math.max(RANK[e1], RANK[e2]));
          if (RANK[e1] === RANK[e2]) expect(d.reasons[0].rule_id).toBe('first');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── P2/P3: default deny ─────────────────────────────────────────────────────

describe('property: default deny (P2, P3)', () => {
  it('documents whose rules never match always deny', () => {
    // Rules gated on a purpose the context never has → no rule can match.
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...EFFECTS), { minLength: 1, maxLength: 4 }),
        (effects) => {
          const rules = effects.map((e, i) => ({ ...unconditional(e, `p-${i}`), when: { purpose: ['never_this_purpose'] } }));
          const d = evaluatePolicy(docWith(rules), ctxWith({}));
          expect(d.effect).toBe('deny');
          expect(d.matched_rule_ids).toHaveLength(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('a document with zero rules denies', () => {
    const d = evaluatePolicy(docWith([]), ctxWith({}));
    expect(d.effect).toBe('deny');
  });
});

// ── P4/P5: amount conditions are sound ──────────────────────────────────────

describe('property: amount soundness (P4, P5)', () => {
  it('a per-rule lte bound never allows an amount above the bound', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000_000 }), // minor units (USDC, 6 decimals)
        (boundMinor) => {
          const bound = `${(boundMinor / 1e6).toFixed(6)}`;
          const doc = docWith([{ id: 'cap', effect: 'allow_with_cap', when: { amount: { lte: { value: bound, asset: 'USDC' } } }, cap: { value: '1000.00', asset: 'USDC' } }]);
          const above = boundMinor + 1;
          const d = evaluatePolicy(doc, ctxWith({ amount_minor: String(above) }));
          expect(d.effect).toBe('deny');
          // At or below the bound it matches:
          const dOk = evaluatePolicy(doc, ctxWith({ amount_minor: String(boundMinor) }));
          expect(['allow_with_cap', 'allow']).toContain(dOk.effect);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('a lower bound (gt) never allows an amount at or below it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000_000 }),
        (boundMinor) => {
          const bound = `${(boundMinor / 1e6).toFixed(6)}`;
          const doc = docWith([{ id: 'floor', effect: 'allow_with_cap', when: { amount: { gt: { value: bound, asset: 'USDC' } } }, cap: { value: '1000.00', asset: 'USDC' } }]);
          const d = evaluatePolicy(doc, ctxWith({ amount_minor: String(boundMinor) }));
          expect(d.effect).toBe('deny');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('global per_transaction_max: amounts above it never allow or require approval', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000_000 }),
        fc.constantFrom(...EFFECTS),
        (boundMinor, effect) => {
          const bound = `${(boundMinor / 1e6).toFixed(6)}`;
          const rule = unconditional(effect, 'r');
          const doc = { ...docWith([rule]), limits: { per_transaction_max: { value: bound, asset: 'USDC' } } };
          const d = evaluatePolicy(doc, ctxWith({ amount_minor: String(boundMinor + 1) }));
          expect(d.effect).toBe('deny');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('cross-asset bounds never match (no implicit FX)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000_000 }),
        (boundMinor) => {
          const doc = docWith([{ id: 'fx', effect: 'allow_with_cap', when: { amount: { gte: { value: `${(boundMinor / 100).toFixed(2)}`, asset: 'USD' } } }, cap: { value: '1.00', asset: 'USDC' } }]);
          // USD bound against a USDC intent: the rule must NOT match, whatever the numbers.
          const d = evaluatePolicy(doc, ctxWith({ amount_minor: String(boundMinor) }));
          expect(d.effect).toBe('deny');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── P6: conditions only ever narrow ─────────────────────────────────────────

describe('property: conditions narrow, never widen (P6)', () => {
  it('adding a when-clause that the context fails can only lower the effect rank', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EFFECTS),
        fc.constantFrom(...EFFECTS),
        (e1, e2) => {
          // Same effect twice; second copy is gated on an unmatched rail.
          const gated = { ...unconditional(e2, 'gated'), when: { rail: ['manual'] } };
          const d = evaluatePolicy(docWith([unconditional(e1, 'open'), gated]), ctxWith({ rail: 'x402' }));
          expect(RANK[d.effect]).toBe(RANK[e1]);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── P7: the schema rejects hostile documents ────────────────────────────────

describe('property: schema rejects structural tampering (P7)', () => {
  it('unknown top-level and nested fields are validation errors, for any injected key', () => {
    const hostileKeys = fc.constantFrom('eval', '__proto__', 'constructor', '$where', 'script', 'fx_rate', 'bypass');
    fc.assert(
      fc.property(
        hostileKeys,
        fc.constantFrom('document', 'rule', 'when'),
        (key, where) => {
          let doc: unknown;
          if (where === 'document') doc = { schema: 'agent-policy/1', default: 'deny', rules: [], [key]: 1 };
          else if (where === 'rule') doc = { schema: 'agent-policy/1', default: 'deny', rules: [{ id: 'r', effect: 'allow', [key]: 1 }] };
          else doc = { schema: 'agent-policy/1', default: 'deny', rules: [{ id: 'r', effect: 'allow', when: { [key]: 1 } }] };
          const v = validatePolicyDocument(doc);
          expect(v.valid).toBe(false);
          expect(v.errors.some((e) => e.includes(key))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('wrong schema version or missing default deny is always invalid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 20 }).filter((s) => s !== 'agent-policy/1'),
        fc.string({ minLength: 0, maxLength: 10 }).filter((s) => s !== 'deny'),
        (schema, dflt) => {
          const v = validatePolicyDocument({ schema, default: dflt, rules: [] });
          expect(v.valid).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('validate-then-evaluate never throws and never allows on malformed docs', () => {
    // The evaluator re-validates; malformed docs must yield deny, not an exception.
    fc.assert(
      fc.property(
        fc.record({
          schema: fc.option(fc.string(), { nil: undefined }),
          default: fc.option(fc.string(), { nil: undefined }),
          rules: fc.option(fc.array(fc.jsonValue()), { nil: undefined }),
        }),
        (mutant) => {
          const ctx = ctxWith({});
          expect(() => {
            const d = evaluatePolicy(mutant as unknown as Record<string, any>, ctx);
            expect(d.effect).toBe('deny');
          }).not.toThrow();
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── P8: canonical JSON stability ────────────────────────────────────────────

describe('property: canonicalJson (P8)', () => {
  it('is independent of key insertion order', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), fc.integer(), { minKeys: 1, maxKeys: 6 }),
        (obj) => {
          const a = canonicalJson(obj);
          const reordered: Record<string, unknown> = {};
          for (const k of Object.keys(obj).reverse()) reordered[k] = obj[k];
          expect(canonicalJson(reordered)).toBe(a);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('round-trips through JSON.parse for plain JSON trees', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 8 }),
          fc.oneof(fc.integer(), fc.string({ maxLength: 6 }), fc.boolean(), fc.constant(null), fc.array(fc.integer(), { maxLength: 3 })),
          { minKeys: 1, maxKeys: 6 },
        ),
        (obj) => {
          expect(JSON.parse(canonicalJson(obj))).toEqual(obj);
        },
      ),
      { numRuns: 200 },
    );
  });
});
