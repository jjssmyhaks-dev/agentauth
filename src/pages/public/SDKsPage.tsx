import { useState } from "react";
import { motion } from "framer-motion";
import { Code2, Copy, Check, ExternalLink } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="rounded-2xl border border-hairline bg-surface/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
        <span className="text-xs text-muted-foreground font-mono">{lang}</span>
        <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="p-5 text-sm font-mono text-foreground/80 overflow-x-auto leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

const tsCode = `import { AgentAuthClient } from 'agentauth-sdk';

// Initialize the client
const client = new AgentAuthClient({
  agentId: 'your-agent-id',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  baseUrl: 'https://api.agentauth.dev',
});

// Authenticate — gets a short-lived JWT
const token = await client.getToken();

// Check permissions before acting
const { allowed } = await client.checkPermission({
  action: 'read',
  resource: 'database/users',
});

// Submit an action (handles approval flow automatically)
const result = await client.submitAction({
  action: 'write',
  resource: 'database/orders',
  payload: { order_id: '12345', status: 'shipped' },
});

console.log('Action executed:', result);`;

const pyCode = `from agentauth import AgentAuthClient

# Initialize the client
client = AgentAuthClient(
    agent_id="your-agent-id",
    private_key="your-ed25519-private-key",
    base_url="https://api.agentauth.dev",
)

# Authenticate
token = client.get_token()

# Check permissions
result = client.check_permission(
    action="read",
    resource="database/users",
)
print(f"Allowed: {result['allowed']}")

# Submit an action
result = client.submit_action(
    action="write",
    resource="database/orders",
    payload={"order_id": "12345", "status": "shipped"},
)`;

export default function SDKsPage() {
  const [tab, setTab] = useState<"ts" | "py">("ts");

  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="eyebrow mb-4 flex items-center gap-2"><Code2 className="h-3.5 w-3.5" /> SDKs</div>
          <h1 className="text-3xl sm:text-4xl">Integrate in minutes.</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            TypeScript and Python SDKs handle token refresh, challenge signing, approval polling, and error handling.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-6">
            <div className="flex gap-2">
              <button onClick={() => setTab("ts")} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === "ts" ? "bg-foreground text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                TypeScript
              </button>
              <button onClick={() => setTab("py")} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === "py" ? "bg-foreground text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                Python
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-hairline bg-surface/60 p-5">
                <h3 className="text-sm font-medium">npm install</h3>
                <code className="mt-2 block font-mono text-xs text-muted-foreground">npm install agentauth-sdk</code>
              </div>
              <div className="rounded-2xl border border-hairline bg-surface/60 p-5">
                <h3 className="text-sm font-medium">Features</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Automatic token refresh</li>
                  <li>• Challenge-response auth</li>
                  <li>• Approval flow polling</li>
                  <li>• Typed error classes</li>
                  <li>• Webhook callback support</li>
                </ul>
              </div>
              <a href="https://github.com/jjssmyhaks-dev/agentauth" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                View on GitHub <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            {tab === "ts" ? <CodeBlock code={tsCode} lang="TypeScript" /> : <CodeBlock code={pyCode} lang="Python" />}
          </motion.div>
        </div>
      </div>
    </PublicLayout>
  );
}
