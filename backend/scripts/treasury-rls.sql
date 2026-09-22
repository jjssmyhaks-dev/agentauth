-- Agent Treasury — RLS tenant isolation + ledger immutability (PRD §10, FR-LED-1, NFR-3)
--
-- Apply AFTER the backend has booted once with the treasury entities
-- (synchronize: true creates the tables). Idempotent: safe to re-run.
--
-- Notes:
--  - Entities live in the public schema with a `treasury_` prefix (deviation from
--    the PRD's dedicated `treasury` schema — see docs/decisions/0003-treasury-*.md).
--  - In dev the app role owns the tables, so RLS is recorded here but not enforced
--    against the owner; the immutability trigger DOES fire for every role.
--  - In production, run the API as a non-owner role (e.g. agentauth_app) so both
--    layers enforce. The middleware sets `app.org_id` per request.

-- ── 1. Row-level security on every tenant table ────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
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
    'treasury_proof_nonces'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      RAISE NOTICE 'skip % (missing)', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'tenant_isolation'
    ) THEN
      EXECUTE format($f$
        CREATE POLICY tenant_isolation ON public.%I
          USING (org_id = current_setting('app.org_id', true)::uuid)
          WITH CHECK (org_id = current_setting('app.org_id', true)::uuid)
      $f$, t);
    END IF;
  END LOOP;
END $$;

-- ── 2. Ledger immutability (FR-LED-1): no UPDATE/DELETE, ever ──────────────
CREATE OR REPLACE FUNCTION treasury_ledger_no_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'treasury_ledger_entries is append-only: % blocked', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS treasury_ledger_immutable ON public.treasury_ledger_entries;
CREATE TRIGGER treasury_ledger_immutable
  BEFORE UPDATE OR DELETE ON public.treasury_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION treasury_ledger_no_mutation();

-- Truncate is blocked at the statement level.
DROP TRIGGER IF EXISTS treasury_ledger_no_truncate ON public.treasury_ledger_entries;
CREATE TRIGGER treasury_ledger_no_truncate
  BEFORE TRUNCATE ON public.treasury_ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION treasury_ledger_no_mutation();

-- Production only (owner role in dev bypasses REVOKE):
-- REVOKE UPDATE, DELETE, TRUNCATE ON public.treasury_ledger_entries FROM agentauth_app;

-- NOTE: treasury_webhook_outbox is deliberately NOT under RLS — the delivery
-- poller runs org-agnostically in the background, and FORCE RLS with no
-- app.org_id would make it see zero rows (events would silently never send).

-- ── 3. Verification ────────────────────────────────────────────────────────
-- Every treasury table should report RLS enabled with the isolation policy:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'treasury%';
-- SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'treasury%';
