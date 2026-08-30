import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/context/DashboardContext";
import { useNotifications } from "@/context/NotificationContext";
import { Plus, Search, Shield, Key, Trash2, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AgentsPage() {
  const { agents, addAgent, revokeAgent } = useDashboard();
  const { addNotification, pushToast } = useNotifications();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showRevoke, setShowRevoke] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newMode, setNewMode] = useState<"autonomous" | "human-in-the-loop">("human-in-the-loop");

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = useCallback(() => {
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
    addNotification({ type: "agent", priority: "medium", title: `Agent created: ${newName}`, message: `New ${newMode} agent registered with Ed25519 identity`, actionUrl: `/dashboard/agents` });
    pushToast({ type: "agent", priority: "low", title: "Agent created", message: newName });
    setNewName(""); setShowCreate(false);
  }, [newName, newMode, addAgent, addNotification, pushToast]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-between">
        <div><h1 className="text-2xl font-serif">Agents</h1><p className="text-sm text-muted-foreground">Manage agent identities, keys, and approval modes.</p></div>
        <Button onClick={() => setShowCreate(true)} className="rounded-full bg-primary text-primary-foreground hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> New Agent</Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl border-hairline bg-background" /></motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="border-hairline bg-surface/60">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">You haven't registered any agents yet. Create your first agent to get a public key and start issuing tokens.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-hairline text-left">
                    <th className="p-4 eyebrow">Agent</th><th className="p-4 eyebrow">Status</th><th className="p-4 eyebrow">Approval Mode</th><th className="p-4 eyebrow">Created</th><th className="p-4 eyebrow">Last Active</th><th className="p-4 eyebrow text-right">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-hairline/50">
                    <AnimatePresence>
                      {filtered.map((agent, i) => (
                        <motion.tr
                          key={agent.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.25, delay: i * 0.03 }}
                          className="hover:bg-foreground/[0.02] transition-colors"
                        >
                          <td className="p-4"><Link to={`/dashboard/agents/${agent.id}`} className="group"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-foreground/10"><Shield className="h-4 w-4" /></div><div><p className="font-medium group-hover:underline">{agent.name}</p><p className="text-xs text-muted-foreground font-mono">{agent.id.slice(0, 20)}...</p></div></div></Link></td>
                          <td className="p-4"><Badge variant={agent.status === "active" ? "success" : agent.status === "revoked" ? "destructive" : "warning"}>{agent.status}</Badge></td>
                          <td className="p-4"><Badge variant={agent.approvalMode === "autonomous" ? "info" : "secondary"}>{agent.approvalMode === "autonomous" ? "Autonomous" : "HITL"}</Badge></td>
                          <td className="p-4 text-xs text-muted-foreground">{new Date(agent.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 text-xs text-muted-foreground">{new Date(agent.lastActiveAt).toLocaleDateString()}</td>
                          <td className="p-4 text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Rotate Key"><RotateCcw className="h-3.5 w-3.5" /></Button>{agent.status === "active" && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Revoke" onClick={() => setShowRevoke(agent.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}</div></td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Agent Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-hairline bg-surface">
          <DialogHeader><DialogTitle>New Agent</DialogTitle><DialogDescription className="text-muted-foreground">Create a new agent identity. You'll get a public key and agent ID to configure your SDK.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Name</Label><Input placeholder="e.g., Code Review Bot" value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-xl border-hairline bg-background" /></div>
            <div className="space-y-2"><Label>Managed by AgentAuth</Label><p className="text-xs text-muted-foreground">If on, a key pair is generated for you. If off, paste your own public key.</p></div>
            <div className="space-y-2"><Label>Approval Mode Override</Label><Select value={newMode} onValueChange={(v) => setNewMode(v as typeof newMode)}><SelectTrigger className="rounded-xl border-hairline bg-background"><SelectValue /></SelectTrigger><SelectContent className="border-hairline bg-surface"><SelectItem value="human-in-the-loop">Human-in-the-loop</SelectItem><SelectItem value="autonomous">Autonomous</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-full border-hairline">Cancel</Button><Button onClick={handleCreate} className="rounded-full bg-primary text-primary-foreground hover:opacity-90"><Key className="mr-2 h-4 w-4" /> Create Agent</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm */}
      <Dialog open={!!showRevoke} onOpenChange={() => setShowRevoke(null)}>
        <DialogContent className="border-hairline bg-surface">
          <DialogHeader><DialogTitle>Revoke Agent</DialogTitle><DialogDescription className="text-muted-foreground">This can't be undone. All tokens and grants for this agent will be immediately invalidated.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setShowRevoke(null)} className="rounded-full border-hairline">Cancel</Button><Button variant="destructive" onClick={() => {
            if (showRevoke) {
              const agent = agents.find((a) => a.id === showRevoke);
              revokeAgent(showRevoke);
              if (agent) {
                addNotification({ type: "agent", priority: "high", title: `Agent revoked: ${agent.name}`, message: "All active tokens and grants have been invalidated", agentId: agent.id, agentName: agent.name, actionUrl: `/dashboard/agents/${agent.id}` });
                pushToast({ type: "agent", priority: "high", title: "Agent revoked", message: agent.name });
              }
              setShowRevoke(null);
            }
          }}>Revoke Agent</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
