#!/usr/bin/env node
/**
 * RLS tenant-isolation leakage test (PRD §10, NFR-3).
 *
 * Proves PostgreSQL row-level security actually isolates treasury tenants, by
 * simulating two orgs' API connections:
 *
 *   1. Apply treasury-rls.sql, create roles agentauth_tenant_a / _b, GRANT.
 *   2. Seed one row per tenant-scoped table under org A and org B (as the
 *      table owner — owners bypass RLS, which is exactly the API role in dev),
 *      in FK dependency order.
 *   3. Set role A's `app.org_id`: own row visible (1), other org's (0).
 *   4. Same for B: B sees none of A's rows. Unset GUC → zero (fail-closed).
 *      (A connection with A's org_id sees A's rows regardless of login role —
 *      the GUC is the tenancy boundary; that is asserted, not treated as a leak.)
 *   5. No app.org_id set → zero rows everywhere (fail-closed default).
 *   6. Ledger immutability: UPDATE/DELETE as a non-owner → must throw.
 *   7. Cross-tenant INSERT under the other org's id → rejected by WITH CHECK.
 *
 * Exit 0 = no leakage. Any nonzero count or unblocked mutation → exit 1.
 *
 * Env: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE (defaults suit the compose
 * Postgres; PGPASSWORD seeds the throwaway tenant roles, not a secret).
 *
 * CI: runs in the `.github/workflows/ci.yml` rls-leakage job against a
 * Postgres service container. Locally: `node scripts/rls-leakage-test.js`.
 */
const { Client } = require('pg');
const crypto = require('crypto');

const TENANT_TABLES = [
  'treasury_policies',
  'treasury_policy_versions',
  'treasury_mandates',
  'treasury_counterparties',
  'treasury_payment_intents',
  'treasury_budgets',
  'treasury_budget_periods',
  'treasury_budget_reservations',
  'treasury_approvals',
  'treasury_approval_decisions',
  'treasury_authorizations',
  'treasury_kill_switches',
  'treasury_ledger_entries',
  'treasury_rail_connections',
  'treasury_payment_accounts',
  'treasury_proof_nonces',
];

const ORG_A = 'a0000000-0000-4000-8000-00000000000a';
const ORG_B = 'b0000000-0000-4000-8000-00000000000b';
// Per-run suffix keeps unique columns (idempotency_key, jti, nonce) collision-free.
const RUN = crypto.randomUUID().slice(0, 8);

const failures = [];
function fail(msg) {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
}
function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

/**
 * Seed one full dependency chain per org. Every treasury row created here is
 * tenant-scoped under `org`; parents are inserted before children so FKs hold.
 * Returns the number of treasury rows inserted (must equal TENANT_TABLES.length).
 */
async function seedOrg(admin, org) {
  const tag = org.slice(-2); // '0a' / '0b' (used in names)
  const flag = org.slice(-1); // 'a' / 'b' (1 char, for the UUID tail)
  // All IDs derive from RUN so repeated/aborted runs never collide on PKs
  // (last group: RUN(8) + flag(1) + '000' = 12 hex chars).
  const tail = `${RUN}${flag}000`;
  const agentId = `5${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const policyId = `c${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const versionId = `d${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const mandateId = `e${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const counterpartyId = `f${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const intentId = `1${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const budgetId = `2${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const periodId = `3${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const reservationId = `4${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const approvalId = `6${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const connectionId = `7${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();
  const accountId = `8${org.slice(1, 8)}-0000-4000-8000-${tail}`.toLowerCase();

  const jti = `jti-${RUN}-${flag}`;
  const nonceVal = `nonce-${RUN}-${flag}`;
  const correlation = `rls-${RUN}-${flag}`;
  const ksReason = `rls-${RUN}-${flag}`;

  // This org's leftover rail connection from an earlier crashed run would
  // violate the (org_id, rail, environment, provider) unique constraint.
  await admin.query(`DELETE FROM treasury_rail_connections WHERE org_id = $1`, [org]);

  await admin.query(
    `INSERT INTO agents (id, org_id, name, public_key) VALUES ($1,$2,$3,'k') ON CONFLICT (id) DO NOTHING`,
    [agentId, org, `rls-agent-${tag}`],
  );
  const q = (sql, params) => admin.query(sql, params);

  await q(`INSERT INTO treasury_policies (id, org_id, name, status) VALUES ($1,$2,$3,'draft')`, [policyId, org, `rls-policy-${tag}`]);
  await q(
    `INSERT INTO treasury_policy_versions (id, org_id, policy_id, version, document, checksum)
     VALUES ($1,$2,$3,1,$4,'rls-checksum')`,
    [versionId, org, policyId, JSON.stringify({ schema: 'agent-policy/1', default: 'deny', rules: [] })],
  );
  await q(
    `INSERT INTO treasury_mandates (id, org_id, agent_id, granted_by, policy_version_id, hard_limits,
       valid_from, valid_until, canonical_hash, signature, signing_method, signing_key_ref, status)
     VALUES ($1,$2,$3,$4,$5,'{}',now(),now() + interval '10 years','h','s','ed25519','k','active')`,
    [mandateId, org, agentId, org, versionId],
  );
  await q(`INSERT INTO treasury_counterparties (id, org_id, kind, identifier) VALUES ($1,$2,'api_service',$3)`, [
    counterpartyId, org, `cp.${RUN}.${tag}.rls.test`,
  ]);
  await q(
    `INSERT INTO treasury_payment_intents (id, org_id, agent_id, mandate_id, policy_version_id, counterparty_id,
       rail, amount_minor, asset_code, status, request, request_hash, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,'x402',1,'USDC','received','{}','h',$7)`,
    [intentId, org, agentId, mandateId, versionId, counterpartyId, `idem-${RUN}-${tag}`],
  );
  await q(
    `INSERT INTO treasury_budgets (id, org_id, name, scope_type, asset_code, period_kind, limit_minor)
     VALUES ($1,$2,'rls-budget','org','USDC','monthly',100)`,
    [budgetId, org],
  );
  await q(
    `INSERT INTO treasury_budget_periods (id, org_id, budget_id, period_start, period_end, limit_minor)
     VALUES ($1,$2,$3,now(),now() + interval '30 days',100)`,
    [periodId, org, budgetId],
  );
  await q(
    `INSERT INTO treasury_budget_reservations (id, org_id, budget_period_id, payment_intent_id, amount_minor, expires_at, status)
     VALUES ($1,$2,$3,$4,1,now() + interval '1 hour','held')`,
    [reservationId, org, periodId, intentId],
  );
  await q(
    `INSERT INTO treasury_approvals (id, org_id, payment_intent_id, intent_hash, required, expires_at, status)
     VALUES ($1,$2,$3,'h','{}',now() + interval '1 hour','pending')`,
    [approvalId, org, intentId],
  );
  await q(
    `INSERT INTO treasury_approval_decisions (id, org_id, approval_id, principal_id, decision, signature)
     VALUES (gen_random_uuid(),$1,$2,$3,'approve','s')`,
    [org, approvalId, org],
  );
  await q(
    `INSERT INTO treasury_authorizations (id, org_id, payment_intent_id, jti, audience, max_amount_minor, asset_code, expires_at)
     VALUES (gen_random_uuid(),$1,$2,$3,'treasury',1,'USDC',now() + interval '1 hour')`,
    [org, intentId, jti],
  );
  await q(
    `INSERT INTO treasury_kill_switches (id, org_id, scope_type, engaged_by, engaged_at, reason)
     VALUES (gen_random_uuid(),$1,'org',$2,now(),$3)`,
    [org, org, ksReason],
  );
  await q(
    `INSERT INTO treasury_ledger_entries (org_id, entry_type, payment_intent_id, principal_ids, correlation_id,
       occurred_at, prev_hash, entry_hash)
     VALUES ($1,'adjustment',$2,'[]',$3,now(),'0','h')`,
    [org, intentId, correlation],
  );
  await q(
    `INSERT INTO treasury_rail_connections (id, org_id, rail, provider, display_name)
     VALUES ($1,$2,'x402','wallet_provider','RLS connection')`,
    [connectionId, org],
  );
  await q(
    `INSERT INTO treasury_payment_accounts (id, org_id, rail_connection_id, kind, external_ref)
     VALUES ($1,$2,$3,'wallet','ref')`,
    [accountId, org, connectionId],
  );
  await q(
    `INSERT INTO treasury_proof_nonces (id, org_id, agent_id, nonce, proof_ts)
     VALUES (gen_random_uuid(),$1,$2,$3,now())`,
    [org, agentId, nonceVal],
  );

  // Per-run unique selectors: counting THESE rows (not table totals) makes the
  // assertions immune to leftovers from earlier runs or real dev data.
  return {
    treasury_policies: { col: 'id', val: policyId },
    treasury_policy_versions: { col: 'id', val: versionId },
    treasury_mandates: { col: 'id', val: mandateId },
    treasury_counterparties: { col: 'id', val: counterpartyId },
    treasury_payment_intents: { col: 'id', val: intentId },
    treasury_budgets: { col: 'id', val: budgetId },
    treasury_budget_periods: { col: 'id', val: periodId },
    treasury_budget_reservations: { col: 'id', val: reservationId },
    treasury_approvals: { col: 'id', val: approvalId },
    treasury_approval_decisions: { col: 'approval_id', val: approvalId },
    treasury_authorizations: { col: 'jti', val: jti },
    treasury_kill_switches: { col: 'reason', val: ksReason },
    treasury_ledger_entries: { col: 'correlation_id', val: correlation },
    treasury_rail_connections: { col: 'id', val: connectionId },
    treasury_payment_accounts: { col: 'id', val: accountId },
    treasury_proof_nonces: { col: 'nonce', val: nonceVal },
  };
}

async function main() {
  const admin = new Client({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'agentauth',
    password: process.env.PGPASSWORD || 'agentauth',
    database: process.env.PGDATABASE || 'agentauth',
  });
  await admin.connect();

  // ── 0. Environment shape ────────────────────────────────────────────────
  const { rows: enabledRows } = await admin.query(
    `select tablename from pg_tables where schemaname='public' and rowsecurity = true and tablename like 'treasury_%'`,
  );
  const enabled = new Set(enabledRows.map((r) => r.tablename));
  for (const t of TENANT_TABLES) {
    if (!enabled.has(t)) fail(`RLS not enabled on ${t} (run treasury-rls.sql first)`);
  }
  if (enabled.has('treasury_webhook_outbox')) {
    fail('treasury_webhook_outbox must NOT have RLS (the org-agnostic poller would see zero rows and silently stop delivering)');
  }
  if (failures.length) {
    console.error('\nRLS environment incomplete — apply backend/scripts/treasury-rls.sql first.');
    process.exit(1);
  }
  console.log(`  ✓ RLS enabled on all ${TENANT_TABLES.length} tenant tables; outbox excluded as designed`);

  // ── 1. Throwaway tenant roles ───────────────────────────────────────────
  // Revoke first: DROP ROLE fails if privileges were granted to the role
  // (e.g. by an earlier interrupted run).
  await admin.query(
    TENANT_TABLES.map((t) => `REVOKE SELECT, INSERT, UPDATE, DELETE ON public.${t} FROM agentauth_tenant_a, agentauth_tenant_b;`).join('\n'),
  ).catch(() => {});
  await admin.query(`DROP ROLE IF EXISTS agentauth_tenant_a;`);
  await admin.query(`DROP ROLE IF EXISTS agentauth_tenant_b;`);
  await admin.query(`CREATE ROLE agentauth_tenant_a LOGIN PASSWORD 'tenant-a-pass';`);
  await admin.query(`CREATE ROLE agentauth_tenant_b LOGIN PASSWORD 'tenant-b-pass';`);
  await admin.query(
    TENANT_TABLES.map((t) => `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${t} TO agentauth_tenant_a, agentauth_tenant_b;`).join('\n'),
  );
  await admin.query(
    `INSERT INTO organizations (id, name) VALUES ($1,'RLS Org A'),($2,'RLS Org B') ON CONFLICT (id) DO NOTHING`,
    [ORG_A, ORG_B],
  );

  // ── 2. Seed (as owner — owners bypass RLS, like the dev API role) ───────
  const selA = await seedOrg(admin, ORG_A);
  const selB = await seedOrg(admin, ORG_B);
  console.log('  ✓ seeded one full dependency chain per org');

  // ── 3. Tenant visibility over fresh non-owner connections ───────────────
  async function tenantClient(role, password, orgId) {
    const c = new Client({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: role,
      password,
      database: process.env.PGDATABASE || 'agentauth',
    });
    await c.connect();
    if (orgId) await c.query(`SELECT set_config('app.org_id', $1, false)`, [orgId]);
    return c;
  }

  const connA = await tenantClient('agentauth_tenant_a', 'tenant-a-pass', ORG_A);
  const connB = await tenantClient('agentauth_tenant_b', 'tenant-b-pass', ORG_B);
  const anon = await tenantClient('agentauth_tenant_a', 'tenant-a-pass', null);
  // Role B wearing org A's GUC: the GUC — not the login role — is the tenancy
  // boundary (the API sets app.org_id after authenticating the caller), so
  // seeing A's rows here is the DESIGNED behavior, not a leak. The genuine
  // leak scenarios are the other three connections plus the WITH CHECK test.
  const gucOnly = await tenantClient('agentauth_tenant_b', 'tenant-b-pass', ORG_A);

  let checked = 0;
  for (const t of TENANT_TABLES) {
    const s = selA[t];
    // Count THIS RUN's row(s) via a per-run unique selector — immune to
    // leftovers from earlier runs or real dev data sharing the tables.
    const n = async (c, sel) =>
      (
        await c.query(`SELECT count(*)::int AS n FROM public.${t} WHERE ${sel.col} = $1`, [
          sel.val,
        ])
      ).rows[0].n;
    const [a, b, anonN, g] = await Promise.all([
      n(connA, s), // own row → 1
      n(connB, s), // org B must NOT see A's row → 0
      n(anon, s), // unset GUC fails closed → 0
      n(gucOnly, s), // GUC decides tenancy, not the role → 1 (by design)
    ]);
    checked += 1;
    if (a !== 1) fail(`${t}: tenant A sees ${a} of its own rows, expected 1`);
    else if (b !== 0) fail(`${t}: LEAK — tenant B sees ${b} of A's rows`);
    else if (anonN !== 0) fail(`${t}: LEAK — unset app.org_id sees ${anonN} rows (must fail closed)`);
    else if (g !== 1) fail(`${t}: GUC-bound tenancy broken — role B with A's org_id sees ${g} rows, expected 1`);
    else pass(`${t}: 1 own / 0 other-org / 0 unset / GUC-bound`);
  }

  // ── 4. Ledger immutability as non-owner ─────────────────────────────────
  try {
    await connA.query(`UPDATE public.treasury_ledger_entries SET entry_type='tampered'`);
    fail('ledger UPDATE was not blocked by the immutability trigger');
  } catch {
    pass('ledger UPDATE blocked by immutability trigger');
  }
  try {
    await connA.query(`DELETE FROM public.treasury_ledger_entries`);
    fail('ledger DELETE was not blocked by the immutability trigger');
  } catch {
    pass('ledger DELETE blocked by immutability trigger');
  }

  // ── 5. WITH CHECK rejects cross-tenant inserts ──────────────────────────
  try {
    await connB.query(`INSERT INTO public.treasury_counterparties (org_id, kind, identifier) VALUES ($1,'api_service','inj')`, [ORG_A]);
    fail('tenant B inserted a row under org A — WITH CHECK missing?');
  } catch {
    pass('cross-tenant INSERT rejected by WITH CHECK');
  }

  await Promise.all([connA, connB, anon, gucOnly].map((c) => c.end().catch(() => {})));
  await admin.query(
    TENANT_TABLES.map((t) => `REVOKE SELECT, INSERT, UPDATE, DELETE ON public.${t} FROM agentauth_tenant_a, agentauth_tenant_b;`).join('\n'),
  ).catch(() => {});
  await admin.query(`DROP ROLE IF EXISTS agentauth_tenant_a;`);
  await admin.query(`DROP ROLE IF EXISTS agentauth_tenant_b;`);
  await admin.end();

  if (failures.length) {
    console.error(`\n✗ RLS LEAKAGE: ${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log(`\n✓ RLS isolation verified across ${checked} tables: own visible, cross-tenant hidden, unset fails closed, ledger append-only.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('rls-leakage-test crashed:', err.message);
  process.exit(1);
});
