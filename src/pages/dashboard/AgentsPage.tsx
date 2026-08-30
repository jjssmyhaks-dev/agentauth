import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/context/DashboardContext";
import { Plus, Search, Shield, Key, Trash2, RotateCcw } from "lucide-react";

export default function AgentsPage() {
  const { agents, addAgent, revokeAgent } = useDashboard();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showRevoke, setShowRevoke] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newMode, setNewMode] = useState<"autonomous" | "human-in-the-loop">("human-in-the-loop");

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = () => {
    if (!newName) return;
    const id = "ag_" + Date.now().toString(36);
    addAgent({
      id, name: newName, status: "active", approvalMode: newMode,
      publicKey: "ed25519_pk_" + Math.random().toString(36).slice(2, 14),
      fingerprint: "SHA256:" + Math.random().toString(36).slice(2, 10),
      trustLevel: "normal", trustScore: 75, createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(), tokensIssued: 0, actionsTotal: 0,
      actionsAllowed: 0, actionsDenied: 0, tier: "free", tags: [],
    });
    setNewName(""); setShowCreate(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agents</h1>
          <p className="text-sm text-slate-400">Manage agent identities, keys, and approval modes.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> New Agent
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500" />
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="p-4 font-medium text-slate-400">Agent</th>
                  <th className="p-4 font-medium text-slate-400">Status</th>
                  <th className="p-4 font-medium text-slate-400">Approval Mode</th>
                  <th className="p-4 font-medium text-slate-400">Trust Score</th>
                  <th className="p-4 font-medium text-slate-400 text-right">Tokens</th>
                  <th className="p-4 font-medium text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-800/30">
                    <td className="p-4">
                      <Link to={`/dashboard/agents/${agent.id}`} className="group">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/10">
                            <Shield className="h-4 w-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white group-hover:text-blue-400">{agent.name}</p>
                            <p className="text-xs text-slate-500">{agent.id.slice(0, 20)}...</p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="p-4">
                      <Badge variant={agent.status === "active" ? "success" : agent.status === "revoked" ? "destructive" : "warning"}>{agent.status}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={agent.approvalMode === "autonomous" ? "info" : "secondary"}>
                        {agent.approvalMode === "autonomous" ? "⚡ Autonomous" : "🛡️ HITL"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-slate-800">
                          <div className={`h-full rounded-full ${agent.trustScore >= 70 ? "bg-emerald-500" : agent.trustScore >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${agent.trustScore}%` }} />
                        </div>
                        <span className="text-xs text-slate-400">{agent.trustScore}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right text-slate-300">{agent.tokensIssued.toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" title="Rotate key"><RotateCcw className="h-3.5 w-3.5" /></Button>
                        {agent.status === "active" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" title="Revoke" onClick={() => setShowRevoke(agent.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
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
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription className="text-slate-400">Generate a new agent identity with an Ed25519 key pair.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Agent Name</Label>
              <Input placeholder="e.g., Code Review Bot" value={newName} onChange={(e) => setNewName(e.target.value)} className="border-slate-700 bg-slate-800 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Approval Mode</Label>
              <Select value={newMode} onValueChange={(v) => setNewMode(v as typeof newMode)}>
                <SelectTrigger className="border-slate-700 bg-slate-800 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-800">
                  <SelectItem value="human-in-the-loop">🛡️ Human-in-the-loop</SelectItem>
                  <SelectItem value="autonomous">⚡ Autonomous</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={handleCreate} className="bg-blue-600 text-white hover:bg-blue-700"><Key className="mr-2 h-4 w-4" /> Create Agent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showRevoke} onOpenChange={() => setShowRevoke(null)}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Revoke Agent</DialogTitle>
            <DialogDescription className="text-slate-400">This will immediately invalidate all tokens and suspend all grants. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevoke(null)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button variant="destructive" onClick={() => { if (showRevoke) { revokeAgent(showRevoke); setShowRevoke(null); } }}>Revoke Agent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
