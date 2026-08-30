import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Check, BookOpen, ExternalLink } from "lucide-react";

const docs = {
  typescript: {
    install: `npm install agentauth-sdk`,
    setup: `import { AgentAuth } from 'agentauth-sdk';

const client = new AgentAuth({
  agentId: 'ag_01H8X9...',
  privateKey: readFileSync('agent_key.pem', 'utf8'),
  apiUrl: 'https://api.agentauth.com',
});`,
    getToken: `// Get a short-lived signed token
const token = await client.getToken();

// Token is valid for the configured TTL (default: 10 minutes)
// Use it as a Bearer token in API requests
const response = await fetch('https://api.example.com/data', {
  headers: { Authorization: \`Bearer \${token}\` },
});`,
    checkPermission: `// Check if this agent has access to a resource
const allowed = await client.checkPermission({
  resourceType: 'database',
  resource: 'customers_table',
  action: 'write',
});

if (!allowed) {
  console.error('Permission denied');
}`,
    submitAction: `// Submit an action — may require approval
const result = await client.submitAction({
  resourceType: 'database',
  resource: 'customers_table',
  action: 'write',
  payload: { name: 'Acme Corp' },
});

// result.status → "approved" | "pending_approval"
if (result.status === 'pending_approval') {
  // Poll for approval decision
  const decision = await client.waitForApproval(result.approvalId);
  // decision → { approved: boolean, reason?: string }
}`,
  },
  python: {
    install: `pip install agentauth`,
    setup: `from agentauth import AgentAuthClient

client = AgentAuthClient(
    agent_id="ag_01H8X9...",
    private_key=open("agent_key.pem").read(),
    api_url="https://api.agentauth.com"
)`,
    getToken: `# Get a short-lived signed token
token = client.get_token()

# Use it as a Bearer token
import requests
response = requests.get(
    "https://api.example.com/data",
    headers={"Authorization": f"Bearer {token}"}
)`,
    checkPermission: `# Check if this agent has access
allowed = client.check_permission(
    resource_type="database",
    resource="customers_table",
    action="write",
)

if not allowed:
    print("Permission denied")`,
    submitAction: `# Submit an action — may require approval
result = client.submit_action(
    resource_type="database",
    resource="customers_table",
    action="write",
    payload={"name": "Acme Corp"}
)

# result.status → "approved" | "pending_approval"
if result.status == "pending_approval":
    decision = client.wait_for_approval(result.approval_id)
    # decision → {"approved": bool, "reason": str | None}`,
  },
};

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/50 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-xs text-slate-500">{language || "code"}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-sm leading-relaxed text-slate-300 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DocsPage() {
  const [lang, setLang] = useState<"typescript" | "python">("typescript");
  const sections = [
    { id: "install", title: "Install", icon: "📦" },
    { id: "setup", title: "Setup", icon: "⚙️" },
    { id: "getToken", title: "Get Token", icon: "🔑" },
    { id: "checkPermission", title: "Check Permission", icon: "🛡️" },
    { id: "submitAction", title: "Submit Action", icon: "🚀" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">SDK Documentation</h1>
          <p className="text-sm text-slate-400">Integration guides for TypeScript and Python.</p>
        </div>
        <Button variant="outline" className="border-slate-700 text-slate-300">
          <BookOpen className="mr-2 h-4 w-4" /> OpenAPI Docs <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      </div>

      <Tabs value={lang} onValueChange={(v) => setLang(v as "typescript" | "python")}>
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="typescript">TypeScript</TabsTrigger>
          <TabsTrigger value="python">Python</TabsTrigger>
        </TabsList>

        {(["typescript", "python"] as const).map((l) => (
          <TabsContent key={l} value={l} className="space-y-6">
            {sections.map((s) => (
              <Card key={s.id} className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="text-base text-white">
                    <span className="mr-2">{s.icon}</span>{s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={docs[l][s.id as keyof typeof docs.typescript]} language={l} />
                </CardContent>
              </Card>
            ))}

            {/* Token Flow Diagram */}
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader><CardTitle className="text-base text-white">🔄 Token Flow</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { step: "1", text: "Agent requests a challenge nonce (60s TTL)", actor: "Agent → AgentAuth" },
                    { step: "2", text: "Agent signs the nonce with its private key", actor: "Agent" },
                    { step: "3", text: "Exchange signed challenge for a JWT token", actor: "Agent → AgentAuth" },
                    { step: "4", text: "Use JWT as Bearer token in API calls", actor: "Agent → Resource" },
                    { step: "5", text: "Resource verifies JWT, checks grants & approval mode", actor: "AgentAuth → Resource" },
                    { step: "6", text: "Audit log entry created", actor: "AgentAuth" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-center gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{s.step}</div>
                      <div className="flex-1">
                        <p className="text-sm text-white">{s.text}</p>
                        <p className="text-xs text-slate-500">{s.actor}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
