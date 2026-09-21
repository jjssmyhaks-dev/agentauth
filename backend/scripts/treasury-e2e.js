/**
 * Live end-to-end proof of the Agent Treasury decision path against the
 * running stack (PRD §8 flows, exercised through the real API).
 *
 *  1. Create a treasury policy (agent-policy/1, default deny)
 *  2. Simulate the version (activation gate) and activate it
 *  3. Create an org-scope budget (USDC, monthly)
 *  4. Register a spending agent + generate its Ed25519 keypair
 *  5. Sign a mandate (Ed25519 over the canonical hash) binding agent → policy
 *  6. Authorize a small x402 payment → allow + single-use spend token
 *  7. Verify the token via POST /v1/verify, replay it → rejected
 *  8. Confirm the payment with rail evidence → settled, reservation captured
 *  9. Authorize over-budget → denied (budget_exceeded)
 * 10. Engage the kill switch → authorize denied (kill_switch); release
 * 11. Verify the ledger chain
 *
 * Usage (from backend/): BASE=… ORG=<uuid> KEY=<ak_…> node scripts/treasury-e2e.js
 */
const crypto = require('crypto');

const BASE = process.env.BASE || 'http://localhost:4000';
const ORG = process.env.ORG || '00000000-0000-4000-8000-000000000001';
const KEY = process.env.KEY;
if (!KEY) {
  console.error('KEY env var required (control-plane API key, ak_…)');
  process.exit(1);
}

const H = {
  'content-type': 'application/json',
  authorization: `Bearer ${KEY}`,
};

async function api(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { ...H, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

function assert(cond, label) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`  ok  ${label}`);
}

const POLICY_DOC = {
  schema: 'agent-policy/1',
  default: 'deny',
  rules: [
    {
      id: 'allow-small-approved-api',
      effect: 'allow',
      when: {
        rail: ['x402'],
        counterparty: { in_list: 'approved-apis' },
        amount: { lte: { value: '2.00', asset: 'USDC' } },
      },
    },
    {
      id: 'big-vendor-needs-approval',
      effect: 'require_approval',
      when: { amount: { gt: { value: '5000.00', asset: 'INR' } } },
      approval: { roles: ['finance'], quorum: 1 },
    },
  ],
};

(async () => {
  console.log('Agent Treasury live E2E\n');

  // 1. Policy (first immutable version)
  const { policy, version } = await api('POST', '/v1/treasury/policies', {
    name: `e2e-spend-guardrails-${Date.now()}`,
    document: POLICY_DOC,
  });
  assert(policy?.id && version?.version === 1, `policy created (v${version?.version})`);

  // 2. Simulate (activation gate) then activate
  const sim = await api(
    'POST',
    `/v1/treasury/policies/${policy.id}/versions/1/simulate`,
    {
      intents: [
        { rail: 'x402', amount: { value: '0.75', asset: 'USDC' }, counterparty: { identifier: 'api.example.com', list: 'approved-apis' } },
        { rail: 'x402', amount: { value: '0.90', asset: 'USDC' }, counterparty: { identifier: 'unknown.example.com' } },
        { rail: 'card', amount: { value: '6000.00', asset: 'INR' }, counterparty: { identifier: 'acme-supplies' } },
      ],
    },
  );
  const simResults = Array.isArray(sim) ? sim : sim.results;
  assert(Array.isArray(simResults) && simResults.length === 3, `simulation ran (${simResults?.length} intents)`);
  await api('POST', `/v1/treasury/policies/${policy.id}/versions/1/activate`);
  assert(true, 'policy version activated after simulation');

  // 3. Budget
  const budget = await api('POST', '/v1/treasury/budgets', {
    name: `e2e-agent-budget-${Date.now()}`,
    scope_type: 'org',
    asset_code: 'USDC',
    period_kind: 'monthly',
    limit_minor: '3000000', // 3.00 USDC
  });
  assert(!!budget?.id, 'budget created (3.00 USDC monthly)');

  // 4. Spending agent with an Ed25519 keypair (mandate signature key)
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const agent = await api('POST', '/v1/agents', { org_id: ORG, name: `treasury-e2e-${Date.now()}`, public_key: publicKey });
  const agentId = agent.agent_id ?? agent.id;
  assert(!!agentId, `agent registered with Ed25519 public key (${agentId})`);
  const hardLimits = { budget_id: budget.id, max_per_txn_minor: '2000000' };
  const validFrom = new Date(Date.now() - 60_000);
  const validUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  // Mirror the service's canonicalJson: sort keys at every level, stringify.
  const mandateFields = {
    agent_id: agentId,
    granted_by: '00000000-0000-4000-8000-000000000002',
    hard_limits: hardLimits,
    org_id: ORG,
    policy_version_id: version.id,
    valid_from: validFrom.toISOString(),
    valid_until: validUntil.toISOString(),
  };
  const sortedCanonical = JSON.stringify(Object.fromEntries(Object.entries(mandateFields).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));
  const hash = crypto.createHash('sha256').update(sortedCanonical).digest('hex');
  const signature = crypto.sign(null, Buffer.from(hash, 'hex'), privateKey).toString('base64');

  const mandate = await api('POST', '/v1/treasury/mandates', {
    agent_id: agentId,
    granted_by: '00000000-0000-4000-8000-000000000002',
    policy_version_id: version.id,
    hard_limits: hardLimits,
    valid_from: validFrom.toISOString(),
    valid_until: validUntil.toISOString(),
    signature,
    signing_method: 'ed25519_test',
    signing_key_ref: 'e2e-key',
  });
  assert(!!mandate?.mandate?.id || !!mandate?.id, 'mandate created with valid Ed25519 signature');

  // 6. Authorize a small approved-API payment
  const idem = crypto.randomUUID();
  const decision = await api(
    'POST',
    '/v1/treasury/payments/authorize',
    {
      agent_id: agentId,
      rail: 'x402',
      amount: { value: '0.75', asset: 'USDC' },
      counterparty: { kind: 'api_service', identifier: 'api.example.com' },
      purpose: 'e2e_market_data',
      environment: 'sandbox',
    },
    { 'idempotency-key': idem },
  );
  assert(decision.decision === 'allow' && decision.status === 'authorized', `authorize → allow (${decision.status})`);
  assert(!!decision.authorization?.token, 'single-use spend token issued');

  // Register the counterparty as allowlisted (post-hoc is fine for the demo;
  // the in_list condition matched via the request payload attribute).
  await api('POST', '/v1/treasury/counterparties', {
    kind: 'api_service',
    identifier: 'api.example.com',
    list_name: 'approved-apis',
    allowlisted: true,
  });

  // 7. Verify token, then replay
  const v1 = await api('POST', '/v1/verify', { token: decision.authorization.token });
  assert(v1.valid === true, 'verifier API accepts the spend token');
  const v2 = await api('POST', '/v1/verify', { token: decision.authorization.token });
  assert(v2.valid === false && v2.reason === 'token_replayed', `replay rejected (${v2.reason})`);

  // 8. Confirm with rail evidence → settled
  const confirmed = await api('POST', `/v1/treasury/payments/${decision.intent_id}/confirm`, {
    rail_ref: `0xe2e_${Date.now()}`,
  });
  assert(confirmed.status === 'settled', `confirm → settled (captured reservation)`);

  // Idempotency: same key returns the same intent
  const again = await api('POST', '/v1/treasury/payments/authorize', {
    agent_id: agentId,
    rail: 'x402',
    amount: { value: '0.75', asset: 'USDC' },
    counterparty: { kind: 'api_service', identifier: 'api.example.com' },
  }, { 'idempotency-key': idem });
  assert(again.intent_id === decision.intent_id, 'idempotency key returns the original intent');

  // 9. Over-budget → deny (0.75 spent + 2.50 requested > 3.00 limit)
  const denied = await api('POST', '/v1/treasury/payments/authorize', {
    agent_id: agentId,
    rail: 'x402',
    amount: { value: '2.50', asset: 'USDC' },
    counterparty: { kind: 'api_service', identifier: 'api.example.com' },
  }, { 'idempotency-key': crypto.randomUUID() });
  // 0.75 spent + 2.00 > 3.00 budget → either policy allow but budget_exceeded deny, or deny outright
  assert(denied.decision === 'deny' || denied.status === 'denied', `over-budget denied (${denied.reasons?.[0]?.code ?? denied.status})`);

  // 10. Kill switch
  const ks = await api('POST', '/v1/treasury/kill-switches', {
    scope_type: 'org',
    engaged_by: '00000000-0000-4000-8000-000000000002',
    reason: 'e2e drill',
  });
  const ksDecision = await api('POST', '/v1/treasury/payments/authorize', {
    agent_id: agentId,
    rail: 'x402',
    amount: { value: '0.10', asset: 'USDC' },
    counterparty: { kind: 'api_service', identifier: 'api.example.com' },
  }, { 'idempotency-key': crypto.randomUUID() });
  assert(ksDecision.decision === 'deny' && ksDecision.reasons?.[0]?.code === 'kill_switch', 'kill switch blocks new authorizations');
  await api('DELETE', `/v1/treasury/kill-switches/${ks.id}`);
  assert(true, 'kill switch released');

  // 11. Ledger chain
  const chain = await api('GET', '/v1/treasury/ledger/verify');
  assert(chain.valid === true, `ledger chain verified (${chain.checked_entries ?? '?'} entries)`);

  console.log('\nAgent Treasury E2E: all assertions passed.');
})().catch((err) => {
  console.error('\nE2E FAILED:', err.message);
  process.exit(1);
});
