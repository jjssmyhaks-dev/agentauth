import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/context/DashboardContext";
import { Plus, Search, KeyRound } from "lucide-react";

export default function GrantsPage() {
  const { grants, agents, addGrant, revokeGrant } = useDashboard();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ agentId: "", resourceType: "repository", pattern: "", actions: ["read"] });

  const filtered = grants.filter((g) => {
    if (search && !g.agentName.toLowerCase().includes(search.toLowerCase()) && !g.resourcePattern.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter !== "all" && g.status !== filter) return false;
    return true;
  });

  const handleCreate = () => {
    const agent = agents.find((a) => a.id === form.agentId);
    if (!agent) return;
    addGrant({
      id: "gr_" + Date.now().toString(36), agentId: form.agentId, agentName: agent.name,
      resourceType: form.resourceType, resourcePattern: form.pattern, actions: form.actions as any,
      status: "active", grantedAt: new Date().toISOString(), expiresAt: null,
      usageCount: 0, usageCap: null, grantedBy: "admin@acme.com",
    });
    setShowCreate(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Grants & Permissions</h1>
          <p className="text-sm text-slate-400">Manage resource access grants for your agents.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> New Grant</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search by agent or resource..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 border-slate-700 bg-slate-800/50 text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="border-slate-700 bg-slate-800">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-left">
                <th className="p-4 font-medium text-slate-400">Agent</th>
                <th className="p-4 font-medium text-slate-400">Resource</th>
                <th className="p-4 font-medium text-slate-400">Pattern</th>
                <th className="p-4 font-medium text-slate-400">Actions</th>
                <th className="p-4 font-medium text-slate-400">Status</th>
                <th className="p-4 font-medium text-slate-400">Expires</th>
                <th className="p-4 font-medium text-slate-400 text-right">Usage</th>
                <th className="p-4 font-medium text-slate-400 text-right">Manage</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-800/30">
                    <td className="p-4 font-medium text-white">{g.agentName}</td>
                    <td className="p-4"><Badge variant="outline">{g.resourceType}</Badge></td>
                    <td className="p-4 font-mono text-xs text-slate-300">{g.resourcePattern}</td>
                    <td className="p-4"><div className="flex gap-1">{g.actions.map((a) => <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>)}</div></td>
                    <td className="p-4"><Badge variant={g.status === "active" ? "success" : "destructive"}>{g.status}</Badge></td>
                    <td className="p-4 text-xs text-slate-400">{g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : "Never"}</td>
                    <td className="p-4 text-right text-slate-300">{g.usageCount.toLocaleString()}{g.usageCap ? ` / ${g.usageCap.toLocaleString()}` : ""}</td>
                    <td className="p-4 text-right">
                      {g.status === "active" && (
                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => revokeGrant(g.id)}>Revoke</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Create Grant</DialogTitle>
            <DialogDescription className="text-slate-400">Grant an agent access to a resource with specific actions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Agent</Label>
              <Select value={form.agentId} onValueChange={(v) => setForm({ ...form, agentId: v })}>
                <SelectTrigger className="border-slate-700 bg-slate-800 text-white"><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-800">
                  {agents.filter((a) => a.status === "active").map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Resource Type</Label>
              <Input value={form.resourceType} onChange={(e) => setForm({ ...form, resourceType: e.target.value })} className="border-slate-700 bg-slate-800 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Resource Pattern</Label>
              <Input placeholder="e.g., customers_table or repo/*" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className="border-slate-700 bg-slate-800 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.agentId || !form.pattern} className="bg-blue-600 text-white hover:bg-blue-700">
              <KeyRound className="mr-2 h-4 w-4" /> Create Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
