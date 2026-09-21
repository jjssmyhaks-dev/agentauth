import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDashboard } from "@/context/DashboardContext";
import { resolveDataSource } from "@/lib/dataSource";
import {
  ApiError,
  type TreasuryPolicyRow,
  type TreasuryIntent,
  type TreasuryBudget,
  type LedgerRow,
  type KillSwitch,
} from "@/lib/api/client";
import { Wallet, Plus, ShieldOff, ShieldCheck, History, FileJson, Landmark } from "lucide-react";

/**
 * Agent Treasury — operator console (PRD §13 Operator/Controller views).
 *
 * Reads live from the treasury endpoints (`/v1/treasury/*`) in API mode. In
 * mock mode the page explains that treasury is an API-backed surface, so the
 * operator never sees fabricated spend data — money UI must never be fake.
 */

const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "destructive" | "secondary"> = {
  authorized: "success",
  settled: "success",
  allow: "success",
  pending_approval: "warning",
  require_approval: "warning",
  received: "info",
  executing: "info",
  denied: "destructive",
  failed: "destructive",
  expired: "secondary",
  cancelled: "secondary",
};

function statusVariant(status: string): "success" | "warning" | "info" | "destructive" | "secondary" {
  return STATUS_VARIANT[status] ?? "secondary";
}

function fromMinor(minor: string | number | null | undefined, asset: string): string {
  if (minor === null || minor === undefined) return "—";
  const decimals = asset === "USDC" ? 6 : asset === "INR" || asset === "USD" ? 2 : 2;
  const n = BigInt(minor);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const s = abs.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = decimals > 0 ? `.${s.slice(s.length - decimals)}` : "";
  return `${neg ? "-" : ""}${whole}${frac} ${asset}`;
}

/** Client-side half of the demo policy document (also used as the create form seed). */
const POLICY_SEED = {
  schema: "agent-policy/1",
  default: "deny",
  rules: [
    {
      id: "allow-small-api-calls",
      effect: "allow",
      when: {
        rail: ["x402", "manual"],
        counterparty: { in_list: "approved-apis" },
        amount: { lte: { value: "2.00", asset: "USDC" } },
      },
    },
    {
      id: "big-vendor-payments-need-approval",
      effect: "require_approval",
      when: { amount: { gt: { value: "5000.00", asset: "INR" } } },
      approval: { roles: ["finance"], quorum: 1 },
    },
  ],
};

export default function TreasuryPage() {
  const { agents, dataSource } = useDashboard();
  const [policies, setPolicies] = useState<TreasuryPolicyRow[]>([]);
  const [intents, setIntents] = useState<TreasuryIntent[]>([]);
  const [budgets, setBudgets] = useState<TreasuryBudget[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [killSwitches, setKillSwitches] = useState<KillSwitch[]>([]);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPolicy, setShowPolicy] = useState(false);
  const [policyName, setPolicyName] = useState("");
  const [policyDoc, setPolicyDoc] = useState(JSON.stringify(POLICY_SEED, null, 2));
  const [creatingPolicy, setCreatingPolicy] = useState(false);

  const [showBudget, setShowBudget] = useState(false);
  const [budgetName, setBudgetName] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [budgetAsset, setBudgetAsset] = useState("USDC");
  const [budgetPeriod, setBudgetPeriod] = useState("monthly");
  const [creatingBudget, setCreatingBudget] = useState(false);

  const [showKill, setShowKill] = useState(false);
  const [killScope, setKillScope] = useState("org");
  const [killScopeId, setKillScopeId] = useState("");
  const [killReason, setKillReason] = useState("");
  const [engagingKill, setEngagingKill] = useState(false);

  const client = useCallback(async () => {
    const ds = await resolveDataSource();
    if (!ds.client) throw new Error("Treasury requires API mode (VITE_API_URL + backend)");
    return ds.client;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const c = await client();
      const [pol, pay, bud, led, ks] = await Promise.all([
        c.listTreasuryPolicies(),
        c.listTreasuryPayments(),
        c.listTreasuryBudgets(),
        c.listTreasuryLedger(25),
        c.listTreasuryKillSwitches(),
      ]);
      setPolicies(pol);
      setIntents(pay);
      setBudgets(bud);
      setLedger(led);
      setKillSwitches(ks);
      setChainValid(await c.verifyTreasuryLedger());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Failed to load treasury");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeKill = killSwitches.find((k) => !k.released_at);

  const createPolicy = async () => {
    setCreatingPolicy(true);
    try {
      let document: unknown;
      try {
        document = JSON.parse(policyDoc);
      } catch {
        setError("Policy document is not valid JSON");
        return;
      }
      const c = await client();
      await c.createTreasuryPolicy({ name: policyName.trim(), document });
      setShowPolicy(false);
      setPolicyName("");
      setPolicyDoc(JSON.stringify(POLICY_SEED, null, 2));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Policy creation failed");
    } finally {
      setCreatingPolicy(false);
    }
  };

  const createBudget = async () => {
    setCreatingBudget(true);
    try {
      const c = await client();
      // limit is entered in major units; convert to minor per asset decimals
      const decimals = budgetAsset === "USDC" ? 6 : 2;
      const [whole, frac = ""] = budgetLimit.split(".");
      const minor = BigInt(whole + (frac + "0".repeat(decimals)).slice(0, decimals)).toString();
      await c.createTreasuryBudget({
        name: budgetName.trim(),
        scope_type: "org",
        asset_code: budgetAsset,
        period_kind: budgetPeriod,
        limit_minor: minor,
      });
      setShowBudget(false);
      setBudgetName("");
      setBudgetLimit("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Budget creation failed");
    } finally {
      setCreatingBudget(false);
    }
  };

  const engageKillSwitch = async () => {
    setEngagingKill(true);
    try {
      const c = await client();
      await c.engageTreasuryKillSwitch({
        scope_type: killScope,
        scope_id: killScope === "org" ? undefined : killScopeId || undefined,
        engaged_by: "dashboard-operator",
        reason: killReason || undefined,
      });
      setShowKill(false);
      setKillReason("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kill switch failed");
    } finally {
      setEngagingKill(false);
    }
  };

  const releaseKillSwitch = async (id: string) => {
    try {
      const c = await client();
      await c.releaseTreasuryKillSwitch(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Release failed");
    }
  };

  if (dataSource === "mock") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif">Treasury</h1>
          <p className="text-sm text-muted-foreground">
            Spend mandates, policies, budgets and the ledger for agent payments.
          </p>
        </div>
        <Card className="border-hairline bg-surface/60">
          <CardContent className="py-12 text-center">
            <Wallet className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">
              Treasury is an API-backed surface. Connect the dashboard to the backend
              (<code className="text-xs">VITE_API_URL</code>) to manage payments governance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif">Treasury</h1>
          <p className="text-sm text-muted-foreground">
            Spend mandates, deterministic policies, budgets and the append-only ledger.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPolicy(true)}
            className="rounded-full border-hairline"
          >
            <FileJson className="mr-2 h-4 w-4" /> New Policy
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowBudget(true)}
            className="rounded-full border-hairline"
          >
            <Landmark className="mr-2 h-4 w-4" /> New Budget
          </Button>
          {activeKill ? (
            <Button
              variant="outline"
              onClick={() => releaseKillSwitch(activeKill.id)}
              className="rounded-full border-success/50 text-success hover:text-success"
            >
              <ShieldCheck className="mr-2 h-4 w-4" /> Release Kill Switch
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setShowKill(true)}
              className="rounded-full"
            >
              <ShieldOff className="mr-2 h-4 w-4" /> Kill Switch
            </Button>
          )}
        </div>
      </div>

      {activeKill && (
        <Card className="border-destructive/50 bg-destructive/5" role="alert">
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <ShieldOff className="h-4 w-4 text-destructive" aria-hidden="true" />
            <span className="text-sm font-medium text-destructive">
              Kill switch engaged ({activeKill.scope_type}
              {activeKill.scope_id ? `: ${activeKill.scope_id.slice(0, 8)}` : ""})
            </span>
            {activeKill.reason && (
              <span className="text-sm text-muted-foreground">— {activeKill.reason}</span>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40" role="alert">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Policies */}
      <section aria-labelledby="treasury-policies-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="treasury-policies-heading" className="text-lg font-medium">
            Spend Policies
          </h2>
          <span className="text-xs text-muted-foreground">{policies.length} policy{policies.length === 1 ? "" : "ies"}</span>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : policies.length === 0 ? (
          <Card className="border-hairline bg-surface/60">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No policies yet. A signed mandate pins an agent to one immutable policy version — create the first.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {policies.map((p) => (
              <Card key={p.id} className="border-hairline bg-surface/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{p.name}</p>
                    <Badge
                      variant={p.status === "active" ? "success" : p.status === "draft" ? "info" : "secondary"}
                    >
                      {p.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    v{p.latest_version ?? "—"} · {p.simulated_at ? "simulated ✓" : "not simulated"}
                  </p>
                  {Array.isArray(p.latest_document?.rules) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.latest_document.rules.length} rule{p.latest_document.rules.length === 1 ? "" : "s"} · default {String(p.latest_document.default ?? "deny")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Budgets */}
      <section aria-labelledby="treasury-budgets-heading" className="space-y-3">
        <h2 id="treasury-budgets-heading" className="text-lg font-medium">Budgets</h2>
        {budgets.length === 0 && !loading ? (
          <Card className="border-hairline bg-surface/60">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No budgets. Authorizations reserve against a budget — create one to grant spending capacity.
            </CardContent>
          </Card>
        ) : budgets.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2 font-medium">Scope</th>
                  <th scope="col" className="px-4 py-2 font-medium">Limit</th>
                  <th scope="col" className="px-4 py-2 font-medium">Period</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-2">{b.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{b.scope_type}</td>
                    <td className="px-4 py-2">{fromMinor(b.limit_minor, b.asset_code)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{b.period_kind}</td>
                    <td className="px-4 py-2">
                      <Badge variant={b.status === "active" ? "success" : "secondary"}>{b.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* Payment intents */}
      <section aria-labelledby="treasury-intents-heading" className="space-y-3">
        <h2 id="treasury-intents-heading" className="text-lg font-medium">Payment Intents</h2>
        {intents.length === 0 && !loading ? (
          <Card className="border-hairline bg-surface/60">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No payment intents yet. Agents authorize spend via <code className="text-xs">POST /v1/treasury/payments/authorize</code>.
            </CardContent>
          </Card>
        ) : intents.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">Intent</th>
                  <th scope="col" className="px-4 py-2 font-medium">Agent</th>
                  <th scope="col" className="px-4 py-2 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2 font-medium">Rail</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {intents.map((i) => (
                  <tr key={i.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{i.id.slice(0, 8)}</td>
                    <td className="px-4 py-2">{agents.find((a) => a.id === i.agent_id)?.name ?? i.agent_id.slice(0, 8)}</td>
                    <td className="px-4 py-2">{fromMinor(i.amount_minor, i.asset_code)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{i.rail}</td>
                    <td className="px-4 py-2">
                      <Badge variant={statusVariant(i.status)}>{i.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {i.decision_reasons?.[0]?.rule_id ?? i.decision_reasons?.[0]?.code ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* Ledger */}
      <section aria-labelledby="treasury-ledger-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="treasury-ledger-heading" className="text-lg font-medium">Ledger</h2>
          {chainValid !== null && (
            <Badge variant={chainValid ? "success" : "destructive"}>
              {chainValid ? "chain verified" : "CHAIN BROKEN"}
            </Badge>
          )}
        </div>
        {ledger.length === 0 && !loading ? (
          <Card className="border-hairline bg-surface/60">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No ledger entries yet. Every decision, reservation and capture is hash-chained here.
            </CardContent>
          </Card>
        ) : ledger.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">Seq</th>
                  <th scope="col" className="px-4 py-2 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2 font-medium">Correlation</th>
                  <th scope="col" className="px-4 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={String(e.seq)} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{e.seq}</td>
                    <td className="px-4 py-2">{e.entry_type}</td>
                    <td className="px-4 py-2">
                      {e.amount_minor ? fromMinor(e.amount_minor, e.asset_code ?? "") : "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{e.correlation_id}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(e.occurred_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* New Policy dialog */}
      <Dialog open={showPolicy} onOpenChange={setShowPolicy}>
        <DialogContent className="max-w-2xl border-hairline bg-surface">
          <DialogHeader>
            <DialogTitle>New Treasury Policy</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              agent-policy/1 document. Default is deny; unknown fields are rejected. New versions are immutable
              and must be simulated before activation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="treasury-policy-name">Name</Label>
              <Input
                id="treasury-policy-name"
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                placeholder="e.g., agent-spend-guardrails"
                className="rounded-xl border-hairline bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="treasury-policy-doc">Document (JSON)</Label>
              <Textarea
                id="treasury-policy-doc"
                value={policyDoc}
                onChange={(e) => setPolicyDoc(e.target.value)}
                rows={14}
                className="rounded-xl border-hairline bg-background font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPolicy(false)} className="rounded-full border-hairline">Cancel</Button>
            <Button
              onClick={createPolicy}
              disabled={!creatingPolicy && (policyName.trim() === "" || creatingPolicy)}
              className="rounded-full bg-primary text-primary-foreground hover:opacity-90"
            >
              {creatingPolicy ? "Creating…" : "Create Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Budget dialog */}
      <Dialog open={showBudget} onOpenChange={setShowBudget}>
        <DialogContent className="border-hairline bg-surface">
          <DialogHeader>
            <DialogTitle>New Budget</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Authorizations atomically reserve against the current period; captures convert to spend.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="treasury-budget-name">Name</Label>
              <Input
                id="treasury-budget-name"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                placeholder="e.g., Q4 agent API spend"
                className="rounded-xl border-hairline bg-background"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="treasury-budget-limit">Limit</Label>
                <Input
                  id="treasury-budget-limit"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  placeholder="500.00"
                  className="rounded-xl border-hairline bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="treasury-budget-asset">Asset</Label>
                <select
                  id="treasury-budget-asset"
                  value={budgetAsset}
                  onChange={(e) => setBudgetAsset(e.target.value)}
                  className="h-9 w-full rounded-xl border border-hairline bg-background px-2 text-sm"
                >
                  <option>INR</option>
                  <option>USD</option>
                  <option>USDC</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="treasury-budget-period">Period</Label>
                <select
                  id="treasury-budget-period"
                  value={budgetPeriod}
                  onChange={(e) => setBudgetPeriod(e.target.value)}
                  className="h-9 w-full rounded-xl border border-hairline bg-background px-2 text-sm"
                >
                  <option value="one_time">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="rolling_30d">Rolling 30d</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBudget(false)} className="rounded-full border-hairline">Cancel</Button>
            <Button
              onClick={createBudget}
              disabled={budgetName.trim() === "" || budgetLimit.trim() === "" || creatingBudget}
              className="rounded-full bg-primary text-primary-foreground hover:opacity-90"
            >
              {creatingBudget ? "Creating…" : "Create Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kill switch dialog */}
      <Dialog open={showKill} onOpenChange={setShowKill}>
        <DialogContent className="border-hairline bg-surface">
          <DialogHeader>
            <DialogTitle>Engage Kill Switch</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Immediately blocks new authorizations for the scope. In-flight tokens are rejected at the adapter within 5 s.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="treasury-kill-scope">Scope</Label>
              <select
                id="treasury-kill-scope"
                value={killScope}
                onChange={(e) => setKillScope(e.target.value)}
                className="h-9 w-full rounded-xl border border-hairline bg-background px-2 text-sm"
              >
                <option value="org">Entire organization</option>
                <option value="agent">Single agent</option>
                <option value="rail">Rail (manual, x402, card)</option>
              </select>
            </div>
            {killScope !== "org" && (
              <div className="space-y-2">
                <Label htmlFor="treasury-kill-target">
                  {killScope === "agent" ? "Agent" : "Rail"}
                </Label>
                {killScope === "agent" ? (
                  <select
                    id="treasury-kill-target"
                    value={killScopeId}
                    onChange={(e) => setKillScopeId(e.target.value)}
                    className="h-9 w-full rounded-xl border border-hairline bg-background px-2 text-sm"
                  >
                    <option value="">Choose an agent…</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="treasury-kill-target"
                    value={killScopeId}
                    onChange={(e) => setKillScopeId(e.target.value)}
                    placeholder="x402"
                    className="rounded-xl border-hairline bg-background"
                  />
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="treasury-kill-reason">Reason</Label>
              <Input
                id="treasury-kill-reason"
                value={killReason}
                onChange={(e) => setKillReason(e.target.value)}
                placeholder="Why are you pulling the brake?"
                className="rounded-xl border-hairline bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKill(false)} className="rounded-full border-hairline">Cancel</Button>
            <Button
              variant="destructive"
              onClick={engageKillSwitch}
              disabled={engagingKill || (killScope !== "org" && killScopeId.trim() === "")}
              className="rounded-full"
            >
              {engagingKill ? "Engaging…" : "Engage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        Ledger entries are append-only and hash-chained per organization; exports and chain verification are available on the API.
      </p>
    </div>
  );
}
