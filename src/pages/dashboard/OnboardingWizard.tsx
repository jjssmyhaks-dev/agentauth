import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/context/DashboardContext";
import { Shield, Key, CheckCircle2, Rocket, ArrowRight, ArrowLeft, Copy, Check } from "lucide-react";

const steps = [
  { title: "Create your first agent", description: "Give your agent a name and identity", icon: Key },
  { title: "Set a grant", description: "Define what your agent can access", icon: Shield },
  { title: "Choose your default approval mode", description: "Autonomous or human-in-the-loop", icon: CheckCircle2 },
  { title: "You're set", description: "Integrate with the SDK", icon: Rocket },
];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const { addAgent, updateAgent, addGrant, agents } = useDashboard();
  const [agentName, setAgentName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [resourceType, setResourceType] = useState("database");
  const [resourcePattern, setResourcePattern] = useState("customers_table");
  const [grantActions, setGrantActions] = useState<string[]>(["read", "write"]);
  const [approvalMode, setApprovalMode] = useState<"autonomous" | "human-in-the-loop">("human-in-the-loop");
  const [copied, setCopied] = useState(false);

  const handleCreateAgent = () => {
    const id = "ag_" + Date.now().toString(36); setAgentId(id);
    addAgent({ id, name: agentName || "My First Agent", status: "active", approvalMode, publicKey: "ed25519_pk_" + Math.random().toString(36).slice(2, 14), fingerprint: "SHA256:" + Math.random().toString(36).slice(2, 10), trustLevel: "normal", trustScore: 75, createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), tokensIssued: 0, actionsTotal: 0, actionsAllowed: 0, actionsDenied: 0, tier: "free", tags: ["onboarding"] });
    setStep(1);
  };

  const handleCreateGrant = () => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) addGrant({ id: "gr_" + Date.now().toString(36), agentId, agentName: agent.name, resourceType, resourcePattern, actions: grantActions as any, status: "active", grantedAt: new Date().toISOString(), expiresAt: null, usageCount: 0, usageCap: null, grantedBy: "admin@acme.com" });
    setStep(2);
  };

  const handleSetApprovalMode = () => {
    updateAgent(agentId, { approvalMode });
    setStep(3);
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(`client = AgentAuthClient("${agentId}", private_key)\ntoken = client.get_token()`); } catch { /* fallback */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const toggleAction = (a: string) => setGrantActions((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="relative w-full max-w-xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">{steps.map((s, i) => (
            <div key={i} className="flex items-center"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${i < step ? "bg-foreground text-primary-foreground" : i === step ? "bg-foreground/10 text-foreground ring-2 ring-foreground" : "bg-muted text-muted-foreground"}`}>{i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}</div>{i < steps.length - 1 && <div className={`h-0.5 w-12 mx-2 ${i < step ? "bg-foreground" : "bg-muted"}`} />}</div>
          ))}</div>
          <div className="text-center"><h2 className="text-lg font-serif">{steps[step].title}</h2><p className="text-sm text-muted-foreground">{steps[step].description}</p></div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <Card className="border-hairline bg-surface/60"><CardContent className="p-6">
              {step === 0 && <div className="space-y-4"><div className="space-y-2"><Label>Agent Name</Label><Input placeholder="e.g., Code Review Bot" value={agentName} onChange={(e) => setAgentName(e.target.value)} className="rounded-xl border-hairline bg-background" /></div><p className="text-xs text-muted-foreground">A key pair will be generated automatically.</p></div>}
              {step === 1 && <div className="space-y-4">
                <div className="space-y-2"><Label>Resource Type</Label><Select value={resourceType} onValueChange={setResourceType}><SelectTrigger className="rounded-xl border-hairline bg-background"><SelectValue /></SelectTrigger><SelectContent className="border-hairline bg-surface"><SelectItem value="database">Database</SelectItem><SelectItem value="repository">Repository</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="api">API</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Resource Pattern</Label><Input value={resourcePattern} onChange={(e) => setResourcePattern(e.target.value)} className="rounded-xl border-hairline bg-background" /></div>
                <div className="space-y-2"><Label>Allowed Actions</Label><div className="flex gap-2">{["read", "write", "delete", "execute"].map((a) => (<button key={a} onClick={() => toggleAction(a)} className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${grantActions.includes(a) ? "border-foreground bg-foreground text-primary-foreground" : "border-hairline bg-background text-muted-foreground"}`}>{a}</button>))}</div></div>
              </div>}
              {step === 2 && <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
                <button onClick={() => setApprovalMode("autonomous")} className={`rounded-2xl border p-6 text-left transition-all ${approvalMode === "autonomous" ? "border-foreground bg-foreground/5" : "border-hairline hover:border-foreground/50"}`}><div className="text-2xl mb-2">⚡</div><h3 className="font-medium">Autonomous</h3><p className="mt-1 text-xs text-muted-foreground">Agent runs freely without human approval</p></button>
                <button onClick={() => setApprovalMode("human-in-the-loop")} className={`rounded-2xl border p-6 text-left transition-all ${approvalMode === "human-in-the-loop" ? "border-foreground bg-foreground/5" : "border-hairline hover:border-foreground/50"}`}><div className="text-2xl mb-2">🛡️</div><h3 className="font-medium">Human-in-the-loop</h3><p className="mt-1 text-xs text-muted-foreground">Agent waits for your approval on sensitive actions</p></button>
              </div></div>}
              {step === 3 && <div className="space-y-4 text-center">
                <div className="flex justify-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15"><Rocket className="h-7 w-7 text-green-600 dark:text-green-400" /></div></div>
                <div><p className="eyebrow">Agent ID</p><p className="font-mono text-xs mt-1">{agentId}</p></div>
                <div><p className="eyebrow">Approval Mode</p><Badge variant={approvalMode === "autonomous" ? "info" : "secondary"} className="mt-1">{approvalMode}</Badge></div>
                <div className="rounded-2xl border border-hairline bg-background p-4 text-left">
                  <div className="flex items-center justify-between mb-2"><span className="eyebrow">SDK Quickstart</span><button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">{copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy"}</button></div>
                  <pre className="text-xs text-foreground/80 overflow-x-auto">{`client = AgentAuthClient("${agentId}", private_key)\ntoken = client.get_token()`}</pre>
                </div>
              </div>}
            </CardContent></Card>
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 flex justify-between">
          {step > 0 ? <Button variant="ghost" onClick={() => setStep(step - 1)} className="text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button> : <div />}
          {step < 3 ? <Button onClick={() => { if (step === 0) handleCreateAgent(); else if (step === 1) handleCreateGrant(); else handleSetApprovalMode(); }} disabled={(step === 0 && !agentName) || (step === 1 && !resourcePattern)} className="rounded-full bg-primary text-primary-foreground hover:opacity-90">Continue <ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button onClick={onComplete} className="rounded-full bg-primary text-primary-foreground hover:opacity-90">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Button>}
        </div>
      </div>
    </div>
  );
}
