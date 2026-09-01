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
    getToken: `const token = await client.getToken();

const response = await fetch('https://api.example.com/data', {
  headers: { Authorization: \`Bearer \${token}\` },
});`,
    checkPermission: `const allowed = await client.checkPermission({
  resourceType: 'database',
  resource: 'customers_table',
  action: 'write',
});`,
    submitAction: `const result = await client.submitAction({
  resourceType: 'database',
  resource: 'customers_table',
  action: 'write',
  payload: { name: 'Acme Corp' },
});
// result.status → "approved" | "pending_approval"`,
  },
  python: {
    install: `pip install agentauth`,
    setup: `from agentauth import AgentAuthClient

client = AgentAuthClient(
    agent_id="ag_01H8X9...",
    private_key=open("agent_key.pem").read(),
    api_url="https://api.agentauth.com"
)`,
    getToken: `token = client.get_token()

import requests
response = requests.get(
    "https://api.example.com/data",
    headers={"Authorization": f"Bearer {token}"}
)`,
    checkPermission: `allowed = client.check_permission(
    resource_type="database",
    resource="customers_table",
    action="write",
)`,
    submitAction: `result = client.submit_action(
    resource_type="database",
    resource="customers_table",
    action="write",
    payload={"name": "Acme Corp"}
)
# result.status → "approved" | "pending_approval"`,
  },
};

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => { try { await navigator.clipboard.writeText(code); } catch { /* fallback */ } setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="rounded-2xl border border-hairline bg-surface/60 overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <span className="text-xs text-muted-foreground">{language || "code"}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">{copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre className="p-4 text-sm leading-relaxed text-foreground/80 overflow-x-auto"><code>{code}</code></pre>
    </div>
  );
}

export default function DocsPage() {
  const [lang, setLang] = useState<"typescript" | "python">("typescript");
  const sections = [
    { id: "install", title: "Install", icon: "📦" }, { id: "setup", title: "Setup", icon: "⚙️" },
    { id: "getToken", title: "Get Token", icon: "🔑" }, { id: "checkPermission", title: "Check Permission", icon: "🛡️" },
    { id: "submitAction", title: "Submit Action", icon: "🚀" },
  ];

  return (
    <div className="space-y-6 max-w-4xl" id="docs">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-serif">SDK Documentation</h1><p className="text-sm text-muted-foreground">Integration guides for TypeScript and Python.</p></div>
        <Button variant="outline" className="rounded-full border-hairline"><BookOpen className="mr-2 h-4 w-4" /> OpenAPI Docs <ExternalLink className="ml-1 h-3 w-3" /></Button>
      </div>
      <Tabs value={lang} onValueChange={(v) => setLang(v as "typescript" | "python")}>
        <TabsList className="bg-muted border border-hairline"><TabsTrigger value="typescript">TypeScript</TabsTrigger><TabsTrigger value="python">Python</TabsTrigger></TabsList>
        {(["typescript", "python"] as const).map((l) => (
          <TabsContent key={l} value={l} className="space-y-6">
            {sections.map((s) => (<Card key={s.id} className="border-hairline bg-surface/60"><CardHeader><CardTitle className="text-base"><span className="mr-2">{s.icon}</span>{s.title}</CardTitle></CardHeader><CardContent><CodeBlock code={docs[l][s.id as keyof typeof docs.typescript]} language={l} /></CardContent></Card>))}
            <Card className="border-hairline bg-surface/60">
              <CardHeader><CardTitle className="text-base">🔄 Token Flow</CardTitle></CardHeader>
              <CardContent><div className="space-y-3">
                {[{ s: "1", t: "Agent requests a challenge nonce (60s TTL)", a: "Agent → AgentAuth" }, { s: "2", t: "Agent signs the nonce with its private key", a: "Agent" }, { s: "3", t: "Exchange signed challenge for a JWT token", a: "Agent → AgentAuth" }, { s: "4", t: "Use JWT as Bearer token in API calls", a: "Agent → Resource" }, { s: "5", t: "Resource verifies JWT, checks grants & approval mode", a: "AgentAuth → Resource" }, { s: "6", t: "Audit log entry created", a: "AgentAuth" }].map((s) => (
                  <div key={s.s} className="flex items-center gap-3"><div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-medium text-primary-foreground">{s.s}</div><div className="flex-1"><p className="text-sm">{s.t}</p><p className="text-xs text-muted-foreground">{s.a}</p></div></div>
                ))}</div></CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
