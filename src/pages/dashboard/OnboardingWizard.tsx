import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/context/DashboardContext";
import { Shield, Key, CheckCircle2, Rocket, ArrowRight, ArrowLeft, Copy, Check } from "lucide-react";

const steps = [
  { title: "Create First Agent", description: "Give your agent a name and identity", icon: Key },
  { title: "Set a Grant", description: "Define what your agent can access", icon: Shield },
  { title: "Choose Approval Mode", description: "Autonomous or human-in-the-loop", icon: CheckCircle2 },
  { title: "You're Set!", description: "Integrate your agent with the SDK", icon: Rocket },
];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const { addAgent, addGrant, agents } = useDashboard();
  const navigate = useNavigate();

  // Step 1: Agent
  const [agentName, setAgentName] = useState("");
  const [agentId, setAgentId] = useState("");

  // Step 2: Grant
  const [resourceType, setResourceType] = useState("repository");
  const [resourcePattern, setResourcePattern] = useState("");
  const [grantActions, setGrantActions] = useState<string[]>(["read"]);

  // Step 3: Approval mode
  const [approvalMode, setApprovalMode] = useState<"autonomous" | "human-in-the-loop">("human-in-the-loop");

  // Step 4: copied
  const [copied, setCopied] = useState(false);

  const handleCreateAgent = () => {
    const id = "ag_" + Date.now().toString(36);
    setAgentId(id);
    addAgent({
      id, name: agentName || "My First Agent", status: "active", approvalMode: "human-in-the-loop",
      publicKey: "ed25519_pk_" + Math.random().toString(36).slice(2, 14),
      fingerprint: "SHA256:" + Math.random().toString(36).slice(2, 10),
      trustLevel: "normal", trustScore: 75, createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(), tokensIssued: 0, actionsTotal: 0,
      actionsAllowed: 0, actionsDenied: 0, tier: "free", tags: ["onboarding"],
    });
    setStep(1);
  };

  const handleCreateGrant = () => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent && resourcePattern) {
      addGrant({
        id: "gr_" + Date.now().toString(36), agentId, agentName: agent.name,
        resourceType, resourcePattern, actions: grantActions as any,
        status: "active", grantedAt: new Date().toISOString(), expiresAt: null,
        usageCount: 0, usageCap: null, grantedBy: "admin@acme.com",
      });
    }
    setStep(2);
  };

  const handleCopy = () => {
    const code = `import { AgentAuth } from 'agentauth-sdk';

const client = new AgentAuth({
  agentId: '${agentId}',
  privateKey: readFileSync('agent_key.pem', 'utf8'),
});

const token = await client.getToken();`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleAction = (action: string) => {
    setGrantActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,rgba(59,130,246,0.12),transparent)]" />

      <div className="relative w-full max-w-xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  i < step ? "bg-blue-600 text-white" : i === step ? "bg-blue-600/20 text-blue-400 ring-2 ring-blue-600" : "bg-slate-800 text-slate-500"
                }`}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 w-12 mx-2 ${i < step ? "bg-blue-600" : "bg-slate-800"}`} />}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white">{steps[step].title}</h2>
            <p className="text-sm text-slate-400">{steps[step].description}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl">
              <CardContent className="p-6">
                {step === 0 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Agent Name</Label>
                      <Input placeholder="e.g., Code Review Bot" value={agentName} onChange={(e) => setAgentName(e.target.value)} className="border-slate-700 bg-slate-800 text-white" />
                    </div>
                    <p className="text-xs text-slate-500">An Ed25519 key pair will be generated automatically.</p>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Resource Type</Label>
                      <Select value={resourceType} onValueChange={setResourceType}>
                        <SelectTrigger className="border-slate-700 bg-slate-800 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-800">
                          <SelectItem value="repository">Repository</SelectItem>
                          <SelectItem value="database">Database</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="api">API</SelectItem>
                          <SelectItem value="file_system">File System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Resource Pattern</Label>
                      <Input placeholder="e.g., customers_table or repo/*" value={resourcePattern} onChange={(e) => setResourcePattern(e.target.value)} className="border-slate-700 bg-slate-800 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Allowed Actions</Label>
                      <div className="flex gap-2">
                        {["read", "write", "delete", "execute"].map((a) => (
                          <button key={a} onClick={() => toggleAction(a)} className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${grantActions.includes(a) ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"}`}>
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <button onClick={() => setApprovalMode("autonomous")} className={`rounded-xl border p-6 text-left transition-all ${approvalMode === "autonomous" ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-800/50 hover:border-slate-600"}`}>
                        <div className="text-2xl mb-2">⚡</div>
                        <h3 className="font-semibold text-white">Autonomous</h3>
                        <p className="mt-1 text-xs text-slate-400">Agent runs freely without human approval</p>
                      </button>
                      <button onClick={() => setApprovalMode("human-in-the-loop")} className={`rounded-xl border p-6 text-left transition-all ${approvalMode === "human-in-the-loop" ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-800/50 hover:border-slate-600"}`}>
                        <div className="text-2xl mb-2">🛡️</div>
                        <h3 className="font-semibold text-white">Human-in-the-loop</h3>
                        <p className="mt-1 text-xs text-slate-400">Agent waits for your approval on sensitive actions</p>
                      </button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4 text-center">
                    <div className="flex justify-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15"><Rocket className="h-7 w-7 text-emerald-400" /></div></div>
                    <div>
                      <p className="text-sm text-slate-400">Agent ID</p>
                      <p className="font-mono text-xs text-white mt-1">{agentId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Approval Mode</p>
                      <Badge variant={approvalMode === "autonomous" ? "info" : "secondary"} className="mt-1">{approvalMode}</Badge>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4 text-left">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">SDK Quickstart</span>
                        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
                          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <pre className="text-xs text-slate-300 overflow-x-auto">
{`import { AgentAuth } from 'agentauth-sdk';

const client = new AgentAuth({
  agentId: '${agentId}',
  privateKey: readFileSync('agent_key.pem'),
});

const token = await client.getToken();`}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} className="text-slate-400">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <Button onClick={() => {
              if (step === 0) handleCreateAgent();
              else if (step === 1) handleCreateGrant();
              else setStep(3);
            }} disabled={(step === 0 && !agentName) || (step === 1 && !resourcePattern)} className="bg-blue-600 text-white hover:bg-blue-700">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={onComplete} className="bg-blue-600 text-white hover:bg-blue-700">
              Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
