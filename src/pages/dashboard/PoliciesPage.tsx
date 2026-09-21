import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDashboard } from "@/context/DashboardContext";
import { useAuth } from "@/context/AuthContext";
import { resolveDataSource } from "@/lib/dataSource";
import type { Policy, PolicyAction, PolicyTrigger, PolicyCondition, PolicyScope, PolicyVersion, PolicyDryRunResult } from "@/types";
import { Plus, Trash2, FlaskConical, ShieldAlert, ShieldCheck, Clock, ArrowUpRight, History } from "lucide-react";

const TRIGGERS: { value: PolicyTrigger; label: string; hint: string }[] = [
  { value: "permission_check", label: "Permission check", hint: "Fires on every real-time authorization decision" },
  { value: "off_hours", label: "Off hours", hint: "Async event outside business hours" },
  { value: "new_environment", label: "New environment", hint: "Agent seen from an unfamiliar environment" },
  { value: "session_mismatch", label: "Session mismatch", hint: "Possible session hijack detected" },
  { value: "trust_below_threshold", label: "Trust below threshold", hint: "Agent trust score dropped" },
  { value: "resource_sensitivity_high", label: "High resource sensitivity", hint: "Access touching sensitive resources" },
];

const ACTIONS: { value: PolicyAction; label: string; variant: "success" | "warning" | "info" | "destructive" }[] = [
  { value: "allow", label: "Allow", variant: "success" },
  { value: "require_approval", label: "Require approval", variant: "warning" },
  { value: "step_up", label: "Step-up verification", variant: "info" },
  { value: "deny", label: "Deny", variant: "destructive" },
];

const CONDITION_FIELDS = [
  "resource_type",
  "resource_id",
  "action",
  "current_trust_level",
  "resource_sensitivity",
  "off_hours",
  "session_mismatch",
  "new_environment",
  "current_hour",
] as const;

type Operator = "eq" | "ne" | "gte" | "lte" | "exists";

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

function buildConditionEntry(op: Operator, rawValue: string): unknown {
  const value = parseValue(rawValue);
  switch (op) {
    case "eq":
      return value;
    case "ne":
      return { $ne: value };
    case "gte":
      return { $gte: value };
    case "lte":
      return { $lte: value };
    case "exists":
      return { $exists: value !== false };
  }
}

interface ConditionRow {
  field: string;
  op: Operator;
  value: string;
}

/** Mock-mode evaluator — mirrors the backend engine for the common operators
 *  so the demo simulate panel behaves like the real one. */
function evaluateLocally(condition: PolicyCondition, ctx: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(condition)) {
    const actual = ctx[key];
    if (expected === true) { if (!actual) return false; continue; }
    if (expected === false) { if (actual) return false; continue; }
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      for (const [op, operand] of Object.entries(expected as Record<string, unknown>)) {
        if (op === "$ne" && actual === operand) return false;
        if (op === "$eq" && actual !== operand) return false;
        if ((op === "$gte" || op === "$lte" || op === "$gt" || op === "$lt")) {
          if (typeof actual !== "number") return false;
          const n = operand as number;
          if (op === "$gte" && !(actual >= n)) return false;
          if (op === "$lte" && !(actual <= n)) return false;
          if (op === "$gt" && !(actual > n)) return false;
          if (op === "$lt" && !(actual < n)) return false;
        }
        if (op === "$exists" && (operand ? actual === undefined : actual !== undefined)) return false;
        if (op === "$in" && !(Array.isArray(operand) && operand.includes(actual))) return false;
        if (op === "$nin" && (Array.isArray(operand) && operand.includes(actual))) return false;
      }
      continue;
    }
    if (Array.isArray(expected)) { if (!expected.includes(actual)) return false; continue; }
    if (actual !== expected) return false;
  }
  return true;
}

const SCOPE_ORDER: Record<PolicyScope, number> = { org: 0, agent_group: 1, agent: 2 };

export default function PoliciesPage() {
  const { policies, agents, agentGroups, dataSource, addPolicy, setPolicyEnabled, deletePolicy } = useDashboard();
  const { user } = useAuth();
  const orgName = user?.email ? user.email.split("@")[1] ?? "your org" : "your org";

  const [showCreate, setShowCreate] = useState(false);
  const [showTest, setShowTest] = useState(false);

  // Create form state
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<PolicyScope>("org");
  const [scopeAgent, setScopeAgent] = useState<string>("");
  const [scopeGroup, setScopeGroup] = useState<string>("");
  const [trigger, setTrigger] = useState<PolicyTrigger>("permission_check");
  const [action, setAction] = useState<PolicyAction>("require_approval");
  const [priority, setPriority] = useState("50");
  const [rows, setRows] = useState<ConditionRow[]>([{ field: "resource_type", op: "eq", value: "database" }]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Simulate form state
  const [simAgent, setSimAgent] = useState("");
  const [simTrigger, setSimTrigger] = useState<PolicyTrigger>("permission_check");
  const [simOffHours, setSimOffHours] = useState(false);
  const [simMismatch, setSimMismatch] = useState(false);
  const [simSensitivity, setSimSensitivity] = useState("high");
  const [simResourceType, setSimResourceType] = useState("database");
  const [simAction, setSimAction] = useState("delete");
  const [simResult, setSimResult] = useState<Awaited<ReturnType<typeof runSimulation>> | null>(null);
  const [simulating, setSimulating] = useState(false);

  const sortedPolicies = useMemo(
    () =>
      [...policies].sort(
        (a, b) =>
          SCOPE_ORDER[b.scope] - SCOPE_ORDER[a.scope] ||
          b.priority - a.priority ||
          a.createdAt.localeCompare(b.createdAt),
      ),
    [policies],
  );

  const canSubmit =
    !creating &&
    (scope !== "agent" || scopeAgent !== "") &&
    (scope !== "agent_group" || scopeGroup !== "") &&
    rows.every((r) => r.field && r.value !== "") &&
    description.trim() !== "";

  const handleCreate = async () => {
    if (!canSubmit) return;
    setCreating(true);
    setCreateError(null);
    const condition: PolicyCondition = {};
    for (const row of rows) condition[row.field] = buildConditionEntry(row.op, row.value);
    try {
      await addPolicy({
        scope,
        scopeTargetId: scope === "agent" ? scopeAgent : scope === "agent_group" ? scopeGroup : null,
        trigger,
        condition,
        action,
        priority: Number(priority) || 0,
        enabled: true,
        description: description.trim(),
      });
      setShowCreate(false);
      setDescription("");
      setRows([{ field: "resource_type", op: "eq", value: "database" }]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create policy");
    } finally {
      setCreating(false);
    }
  };

  async function runSimulation(): Promise<{
    wouldFire: boolean;
    action: PolicyAction | null;
    reason: string | null;
    policiesChecked: number;
    order: string[];
  }> {
    if (dataSource === "api") {
      const { resolveDataSource } = await import("@/lib/dataSource");
      const { client } = await resolveDataSource();
      if (!client) throw new Error("API client unavailable");
      const res = await client.simulatePolicy({
        trigger: simTrigger,
        agentId: simAgent,
        offHours: simOffHours,
        sessionMismatch: simMismatch,
        newEnvironment: false,
        resourceSensitivity: simSensitivity || undefined,
        currentTrustLevel: "normal",
        resourceType: simResourceType || undefined,
        resourceId: "simulated/record",
        action: simAction || undefined,
      });
      return {
        wouldFire: res.wouldFire,
        action: res.result.matched ? res.result.action : null,
        reason: res.result.reason ?? null,
        policiesChecked: res.policiesChecked,
        order: res.evaluatedOrder.map(
          (m) => `${m.policyId.slice(0, 8)} → ${ACTIONS.find((a) => a.value === m.action)?.label ?? m.action}`,
        ),
      };
    }
    // Mock mode: evaluate local policies against the hypothetical event.
    const ctx: Record<string, unknown> = {
      trigger: simTrigger,
      off_hours: simOffHours,
      session_mismatch: simMismatch,
      new_environment: false,
      resource_sensitivity: simSensitivity || undefined,
      current_trust_level: "normal",
      agent_id: simAgent,
      resource_type: simResourceType || undefined,
      action: simAction || undefined,
    };
    const matching = sortedPolicies
      .filter((p) => p.enabled && p.trigger === simTrigger)
      .filter((p) => p.scope !== "agent" || p.scopeTargetId === simAgent)
      .filter((p) => evaluateLocally(p.condition, ctx));
    const first = matching[0];
    return {
      wouldFire: !!first,
      action: first?.action ?? null,
      reason: first?.description ?? null,
      policiesChecked: policies.filter((p) => p.enabled).length,
      order: matching.map((m) => `${m.id} → ${ACTIONS.find((a) => a.value === m.action)?.label ?? m.action}`),
    };
  }

  const handleSimulate = async () => {
    if (!simAgent) return;
    setSimulating(true);
    try {
      setSimResult(await runSimulation());
    } catch (err) {
      setSimResult({
        wouldFire: false,
        action: null,
        reason: err instanceof Error ? err.message : "Simulation failed",
        policiesChecked: 0,
        order: [],
      });
    } finally {
      setSimulating(false);
    }
  };

  // History dialog state
  const [historyPolicy, setHistoryPolicy] = useState<Policy | null>(null);
  const [versions, setVersions] = useState<PolicyVersion[] | null>(null);
  const [dryRun, setDryRun] = useState<PolicyDryRunResult | null>(null);
  const [dryRunAction, setDryRunAction] = useState<PolicyAction>("deny");
  const [dryRunPriority, setDryRunPriority] = useState("50");
  const [dryRunBusy, setDryRunBusy] = useState(false);

  const openHistory = async (p: Policy) => {
    setHistoryPolicy(p);
    setVersions(null);
    setDryRun(null);
    setDryRunAction(p.action);
    setDryRunPriority(String(p.priority));
    if (dataSource !== "api") return;
    const { client } = await resolveDataSource();
    if (!client) return;
    try {
      setVersions(await client.listPolicyVersions(p.id));
    } catch {
      setVersions([]);
    }
  };

  const handleDryRun = async () => {
    if (!historyPolicy) return;
    setDryRunBusy(true);
    try {
      const { client } = await resolveDataSource();
      if (!client) return;
      setDryRun(
        await client.dryRunPolicy(historyPolicy.id, {
          action: dryRunAction,
          priority: Number(dryRunPriority) || 0,
        }),
      );
    } finally {
      setDryRunBusy(false);
    }
  };

  const actionBadge = (a: PolicyAction) => {
    const meta = ACTIONS.find((x) => x.value === a);
    return <Badge variant={meta?.variant ?? "default"}>{meta?.label ?? a}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Policies</h1>
          <p className="text-sm text-muted-foreground">
            Real-time rules that gate every permission check — deny, step up, or require a human.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTest(true)} className="rounded-full border-hairline">
            <FlaskConical className="mr-2 h-4 w-4" /> Test a policy
          </Button>
          <Button onClick={() => setShowCreate(true)} className="rounded-full bg-primary text-primary-foreground hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" /> New Policy
          </Button>
        </div>
      </div>

      <Card className="border-hairline bg-surface/60">
        <CardContent className="p-0">
          {sortedPolicies.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No policies yet. Without policies, every matched grant is allowed outright.
            </p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Authorization policies, ordered by scope specificity then priority</caption>
              <thead>
                <tr className="border-b border-hairline text-left">
                  <th scope="col" className="p-4 eyebrow">Rule</th>
                  <th scope="col" className="p-4 eyebrow">Trigger</th>
                  <th scope="col" className="p-4 eyebrow">Decision</th>
                  <th scope="col" className="p-4 eyebrow">Scope</th>
                  <th scope="col" className="p-4 eyebrow">Priority</th>
                  <th scope="col" className="p-4 eyebrow">Enabled</th>
                  <th scope="col" className="p-4 eyebrow text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline/50">
                {sortedPolicies.map((p) => (
                  <tr key={p.id} className={p.enabled ? "hover:bg-foreground/[0.02]" : "opacity-50 hover:bg-foreground/[0.02]"}>
                    <td className="p-4">
                      <p className="font-medium">{p.description || <span className="text-muted-foreground">(no description)</span>}</p>
                      {Object.keys(p.condition ?? {}).length > 0 && (
                        <code className="mt-1 block font-mono text-xs text-muted-foreground">{JSON.stringify(p.condition)}</code>
                      )}
                    </td>
                    <td className="p-4 text-xs">{TRIGGERS.find((t) => t.value === p.trigger)?.label ?? p.trigger}</td>
                    <td className="p-4">{actionBadge(p.action)}</td>
                    <td className="p-4 text-xs text-muted-foreground">
                      {p.scope === "agent"
                        ? agents.find((a) => a.id === p.scopeTargetId)?.name ?? "agent"
                        : p.scope === "agent_group"
                          ? agentGroups.find((g) => g.id === p.scopeTargetId)?.name ?? "group"
                          : `${orgName} (org-wide)`}
                    </td>
                    <td className="p-4 font-mono text-xs">{p.priority}</td>
                    <td className="p-4">
                      <Switch
                        checked={p.enabled}
                        onCheckedChange={(v) => setPolicyEnabled(p.id, v)}
                        aria-label={`${p.enabled ? "Disable" : "Enable"} policy: ${p.description || p.id}`}
                      />
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void openHistory(p)}
                        aria-label={`View history: ${p.description || p.id}`}
                      >
                        <History className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">History</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deletePolicy(p.id)}
                        aria-label={`Delete policy: ${p.description || p.id}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-hairline bg-surface sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Policy</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              First matching policy wins — more specific scope and higher priority evaluate first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="policy-description">Description</Label>
              <Input
                id="policy-description"
                placeholder="e.g., Database deletes always need a human"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl border-hairline bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="policy-scope">Scope</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as PolicyScope)}>
                  <SelectTrigger id="policy-scope" className="rounded-xl border-hairline bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org">Whole organization</SelectItem>
                    <SelectItem value="agent">Specific agent</SelectItem>
                    <SelectItem value="agent_group" disabled={agentGroups.length === 0}>
                      Agent group{agentGroups.length === 0 ? " (none yet)" : ""}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scope === "agent" && (
                <div className="space-y-2">
                  <Label htmlFor="policy-agent">Agent</Label>
                  <Select value={scopeAgent} onValueChange={setScopeAgent}>
                    <SelectTrigger id="policy-agent" className="rounded-xl border-hairline bg-background">
                      <SelectValue placeholder="Pick an agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {scope === "agent_group" && (
                <div className="space-y-2">
                  <Label htmlFor="policy-group">Agent group</Label>
                  <Select value={scopeGroup} onValueChange={setScopeGroup}>
                    <SelectTrigger id="policy-group" className="rounded-xl border-hairline bg-background">
                      <SelectValue placeholder="Pick a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="policy-priority">Priority</Label>
                <Input
                  id="policy-priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="rounded-xl border-hairline bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="policy-trigger">Trigger</Label>
                <Select value={trigger} onValueChange={(v) => setTrigger(v as PolicyTrigger)}>
                  <SelectTrigger id="policy-trigger" className="rounded-xl border-hairline bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{TRIGGERS.find((t) => t.value === trigger)?.hint}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="policy-action">Then</Label>
                <Select value={action} onValueChange={(v) => setAction(v as PolicyAction)}>
                  <SelectTrigger id="policy-action" className="rounded-xl border-hairline bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>When all of these match</Label>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Label htmlFor={`cond-field-${i}`} className="sr-only">Condition field {i + 1}</Label>
                    <Select value={row.field} onValueChange={(v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, field: v } : r)))}>
                      <SelectTrigger id={`cond-field-${i}`} className="rounded-xl border-hairline bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_FIELDS.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label htmlFor={`cond-op-${i}`} className="sr-only">Condition operator {i + 1}</Label>
                    <Select value={row.op} onValueChange={(v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, op: v as Operator } : r)))}>
                      <SelectTrigger id={`cond-op-${i}`} className="w-24 rounded-xl border-hairline bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eq">is</SelectItem>
                        <SelectItem value="ne">is not</SelectItem>
                        <SelectItem value="gte">≥</SelectItem>
                        <SelectItem value="lte">≤</SelectItem>
                        <SelectItem value="exists">exists</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label htmlFor={`cond-value-${i}`} className="sr-only">Condition value {i + 1}</Label>
                    <Input
                      id={`cond-value-${i}`}
                      value={row.value}
                      disabled={row.op === "exists"}
                      onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                      className="rounded-xl border-hairline bg-background"
                      placeholder="value"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      aria-label={`Remove condition ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, { field: "action", op: "eq", value: "write" }])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add condition
              </Button>
            </div>
            {createError && (
              <p role="alert" className="text-sm text-destructive">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-full border-hairline">Cancel</Button>
            <Button onClick={handleCreate} disabled={!canSubmit} className="rounded-full bg-primary text-primary-foreground hover:opacity-90">
              <ShieldCheck className="mr-2 h-4 w-4" /> {creating ? "Creating…" : "Create Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simulate dialog */}
      <Dialog open={showTest} onOpenChange={(open) => { setShowTest(open); if (!open) setSimResult(null); }}>
        <DialogContent className="border-hairline bg-surface sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Test a policy</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Fire a hypothetical event at your policies and see exactly which rule would win.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sim-agent">Agent</Label>
                <Select value={simAgent} onValueChange={setSimAgent}>
                  <SelectTrigger id="sim-agent" className="rounded-xl border-hairline bg-background">
                    <SelectValue placeholder="Pick an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sim-trigger">Trigger</Label>
                <Select value={simTrigger} onValueChange={(v) => setSimTrigger(v as PolicyTrigger)}>
                  <SelectTrigger id="sim-trigger" className="rounded-xl border-hairline bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch id="sim-off-hours" checked={simOffHours} onCheckedChange={setSimOffHours} />
                <Label htmlFor="sim-off-hours">Off hours</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="sim-mismatch" checked={simMismatch} onCheckedChange={setSimMismatch} />
                <Label htmlFor="sim-mismatch">Session mismatch</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="sim-sensitivity" className="text-sm">Sensitivity</Label>
                <Input
                  id="sim-sensitivity"
                  value={simSensitivity}
                  onChange={(e) => setSimSensitivity(e.target.value)}
                  className="h-8 w-24 rounded-xl border-hairline bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sim-resource-type">Resource type</Label>
                <Input
                  id="sim-resource-type"
                  value={simResourceType}
                  onChange={(e) => setSimResourceType(e.target.value)}
                  className="rounded-xl border-hairline bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sim-action">Action</Label>
                <Input
                  id="sim-action"
                  value={simAction}
                  onChange={(e) => setSimAction(e.target.value)}
                  className="rounded-xl border-hairline bg-background"
                />
              </div>
            </div>
            <Button onClick={handleSimulate} disabled={!simAgent || simulating} className="rounded-full bg-primary text-primary-foreground hover:opacity-90">
              <FlaskConical className="mr-2 h-4 w-4" /> {simulating ? "Evaluating…" : "Run simulation"}
            </Button>
            {simResult && (
              <div
                role="status"
                className={`rounded-xl border p-4 ${
                  simResult.action === "deny"
                    ? "border-destructive/30 bg-destructive/5"
                    : simResult.wouldFire
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-green-500/30 bg-green-500/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  {simResult.action === "deny" ? (
                    <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden="true" />
                  ) : simResult.wouldFire ? (
                    <Clock className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-green-600" aria-hidden="true" />
                  )}
                  <p className="font-medium">
                    {simResult.wouldFire
                      ? simResult.action === "deny"
                        ? "This request would be denied"
                        : `Decision: ${ACTIONS.find((a) => a.value === simResult.action)?.label ?? simResult.action}`
                      : "No policy fires — default allow (if a grant matches)"}
                  </p>
                </div>
                {simResult.reason && (
                  <p className="mt-1 text-xs text-muted-foreground">{simResult.reason}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{simResult.policiesChecked} enabled policies checked</p>
                {simResult.order.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {simResult.order.map((line, i) => (
                      <li key={i} className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTest(false)} className="rounded-full border-hairline">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History + dry-run dialog */}
      <Dialog open={!!historyPolicy} onOpenChange={(open) => { if (!open) setHistoryPolicy(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-hairline bg-surface sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Policy history</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Every change, who made it, and a dry-run of what a new change would alter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {dataSource !== "api" ? (
              <p className="text-sm text-muted-foreground">
                Version history requires API mode — the demo's mock data source keeps no history.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {versions === null ? (
                    <p className="text-sm text-muted-foreground">Loading history…</p>
                  ) : versions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recorded versions.</p>
                  ) : (
                    <ol className="space-y-2">
                      {versions.map((v) => (
                        <li key={v.id} className="rounded-xl border border-hairline p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              v{v.version} · {v.changeType}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(v.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">by {v.changedBy ?? "system"}</p>
                          {Object.keys(v.diff).length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {Object.entries(v.diff).map(([field, d]) => (
                                <li key={field} className="font-mono text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{field}</span>: {JSON.stringify(d.from)} → {JSON.stringify(d.to)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {historyPolicy && (
                  <div className="space-y-3 rounded-xl border border-hairline p-4">
                    <p className="text-sm font-medium">Dry-run a change</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="dry-run-action">Then</Label>
                        <Select value={dryRunAction} onValueChange={(v) => setDryRunAction(v as PolicyAction)}>
                          <SelectTrigger id="dry-run-action" className="rounded-xl border-hairline bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTIONS.map((a) => (
                              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dry-run-priority">Priority</Label>
                        <Input
                          id="dry-run-priority"
                          type="number"
                          value={dryRunPriority}
                          onChange={(e) => setDryRunPriority(e.target.value)}
                          className="rounded-xl border-hairline bg-background"
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDryRun}
                      disabled={dryRunBusy}
                      className="rounded-full border-hairline"
                    >
                      <FlaskConical className="mr-2 h-3.5 w-3.5" /> {dryRunBusy ? "Computing…" : "Preview diff"}
                    </Button>
                    {dryRun && (
                      <div role="status" className="rounded-xl border border-hairline p-3">
                        {dryRun.wouldChange ? (
                          <ul className="space-y-1">
                            {Object.entries(dryRun.changes).map(([field, d]) => (
                              <li key={field} className="font-mono text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{field}</span>: {JSON.stringify(d.from)} → {JSON.stringify(d.to)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No changes — this candidate is identical.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryPolicy(null)} className="rounded-full border-hairline">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
