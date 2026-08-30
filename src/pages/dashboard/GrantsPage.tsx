import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/context/DashboardContext";
import { useNotifications } from "@/context/NotificationContext";
import { Plus, Search, KeyRound } from "lucide-react";
import EmptyState from "@/components/EmptyState"

export default function GrantsPage() {
  const { grants, agents, addGrant, revokeGrant } = useDashboard();
  const { addNotification, pushToast } = useNotifications();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ agentId: "", resourceType: "database", pattern: "", actions: ["read"] as string[], expiry: "never", usageCap: "" });

  const filtered = grants.filter((g) => {
    if (search && !g.agentName.toLowerCase().includes(search.toLowerCase()) && !g.resourcePattern.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter !== "all" && g.status !== filter) return false;
    return true;
  });

  const handleCreate = useCallback(() => {
    const agent = agents.find((a) => a.id === form.agentId);
    if (!agent || !form.pattern) return;
    const grantId = "gr_" + Date.now().toString(36);
    addGrant({
      id: grantId, agentId: form.agentId, agentName: agent.name,
      resourceType: form.resourceType, resourcePattern: form.pattern, actions: form.actions as any,
      status: "active", grantedAt: new Date().toISOString(), expiresAt: null,
      usageCount: 0, usageCap: form.usageCap ? Number(form.usageCap) : null, grantedBy: "admin@acme.com",
    });
    addNotification({ type: "grant", priority: "medium", title: `Grant created: ${form.resourceType}`, message: `${agent.name} granted ${form.actions.join(", ")} on ${form.pattern}`, agentId: agent.id, agentName: agent.name, actionUrl: "/dashboard/grants" });
    pushToast({ type: "grant", priority: "low", title: "Grant created", message: `${agent.name} — ${form.actions.join(", ")} ${form.pattern}` });
    setShowCreate(false);
    setForm({ agentId: "", resourceType: "database", pattern: "", actions: ["read"], expiry: "never", usageCap: "" });
  }, [agents, form, addGrant, addNotification, pushToast]);

  const toggleAction = (a: string) => setForm((f) => ({ ...f, actions: f.actions.includes(a) ? f.actions.filter((x) => x !== a) : [...f.actions, a] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-serif">Grants & Permissions</h1><p className="text-sm text-muted-foreground">Define exactly what each agent can access — nothing is allowed by default.</p></div>
        <Button onClick={() => setShowCreate(true)} className="rounded-full bg-primary text-primary-foreground hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> New Grant</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Filter by agent or resource..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl border-hairline bg-background" /></div>
        <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-40 rounded-xl border-hairline bg-background"><SelectValue /></SelectTrigger><SelectContent className="border-hairline bg-surface"><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="revoked">Revoked</SelectItem></SelectContent></Select>
      </div>

      <Card className="border-hairline bg-surface/60">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No grants configured"
              description="Grants define exactly what each agent can access — nothing is allowed by default. Create your first grant to get started."
              action={<Button onClick={() => setShowCreate(true)} className="rounded-full bg-primary text-primary-foreground hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> Create Grant</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-hairline text-left">
                  <th className="p-4 eyebrow">Agent</th><th className="p-4 eyebrow">Resource Type</th><th className="p-4 eyebrow">Pattern</th><th className="p-4 eyebrow">Actions</th><th className="p-4 eyebrow">Expires</th><th className="p-4 eyebrow">Usage</th><th className="p-4 eyebrow">Status</th><th className="p-4 eyebrow text-right">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-hairline/50">
                  {filtered.map((g) => (
                    <tr key={g.id} className="hover:bg-foreground/[0.02]">
                      <td className="p-4 font-medium">{g.agentName}</td>
                      <td className="p-4"><Badge variant="outline">{g.resourceType}</Badge></td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">{g.resourcePattern}</td>
                      <td className="p-4"><div className="flex gap-1">{g.actions.map((a) => <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>)}</div></td>
                      <td className="p-4 text-xs text-muted-foreground">{g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : "Never"}</td>
                      <td className="p-4 text-xs text-muted-foreground">{g.usageCount.toLocaleString()}{g.usageCap ? ` / ${g.usageCap.toLocaleString()}` : ""}</td>
                      <td className="p-4"><Badge variant={g.status === "active" ? "success" : "destructive"}>{g.status}</Badge></td>
                      <td className="p-4 text-right">{g.status === "active" && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => {
                          revokeGrant(g.id);
                          addNotification({ type: "grant", priority: "high", title: `Grant revoked: ${g.resourceType}`, message: `${g.agentName} access to ${g.resourcePattern} revoked — all actions blocked`, agentId: g.agentId, agentName: g.agentName, actionUrl: "/dashboard/grants" });
                          pushToast({ type: "grant", priority: "high", title: "Grant revoked", message: `${g.agentName} — ${g.resourcePattern}` });
                        }}>Revoke</Button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-hairline bg-surface">
          <DialogHeader><DialogTitle>New Grant</DialogTitle><DialogDescription className="text-muted-foreground">Define what this agent can access and what actions it can perform.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Agent</Label><Select value={form.agentId} onValueChange={(v) => setForm({ ...form, agentId: v })}><SelectTrigger className="rounded-xl border-hairline bg-background"><SelectValue placeholder="Select agent" /></SelectTrigger><SelectContent className="border-hairline bg-surface">{agents.filter((a) => a.status === "active").map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Resource Type</Label><Input placeholder="e.g., database, calendar, repo" value={form.resourceType} onChange={(e) => setForm({ ...form, resourceType: e.target.value })} className="rounded-xl border-hairline bg-background" /></div>
            <div className="space-y-2"><Label>Resource Pattern</Label><Input placeholder="e.g., customers_table or repo/*" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className="rounded-xl border-hairline bg-background" /></div>
            <div className="space-y-2"><Label>Allowed Actions</Label><div className="flex gap-2">{["read", "write", "delete", "execute"].map((a) => <button key={a} onClick={() => toggleAction(a)} className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${form.actions.includes(a) ? "border-foreground bg-foreground text-primary-foreground" : "border-hairline bg-background text-muted-foreground hover:text-foreground"}`}>{a}</button>)}</div></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Expiration</Label><Select value={form.expiry} onValueChange={(v) => setForm({ ...form, expiry: v })}><SelectTrigger className="rounded-xl border-hairline bg-background"><SelectValue /></SelectTrigger><SelectContent className="border-hairline bg-surface"><SelectItem value="never">Never</SelectItem><SelectItem value="30d">30 days</SelectItem><SelectItem value="90d">90 days</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Usage Cap</Label><Input placeholder="Unlimited" value={form.usageCap} onChange={(e) => setForm({ ...form, usageCap: e.target.value })} className="rounded-xl border-hairline bg-background" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-full border-hairline">Cancel</Button><Button onClick={handleCreate} disabled={!form.agentId || !form.pattern} className="rounded-full bg-primary text-primary-foreground hover:opacity-90"><KeyRound className="mr-2 h-4 w-4" /> Create Grant</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
