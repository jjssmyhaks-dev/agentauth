import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Copy, Check } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const sections = [
  { id: "quickstart", title: "Quickstart", items: ["Installation", "First Agent", "Authentication", "Permissions"] },
  { id: "concepts", title: "Core Concepts", items: ["Agent Identity", "Token Lifecycle", "Grants & Permissions", "Approval Modes", "Audit Trail"] },
  { id: "api", title: "API Reference", items: ["Agents", "Tokens", "Grants", "Approvals", "Webhooks"] },
  { id: "sdks", title: "SDKs", items: ["TypeScript SDK", "Python SDK"] },
];

const codeExamples: Record<string, { title: string; code: string; lang: string }> = {
  Installation: { title: "Install the SDK", code: `npm install agentauth-sdk\n# or\npip install agentauth`, lang: "bash" },
  "First Agent": { title: "Create an agent", code: `import { AgentAuthClient } from 'agentauth-sdk';\n\nconst client = new AgentAuthClient({\n  agentId: 'my-agent-id',\n  privateKey: process.env.AGENT_PRIVATE_KEY,\n  baseUrl: 'https://api.agentauth.dev',\n});`, lang: "typescript" },
  Authentication: { title: "Get a token", code: `const token = await client.getToken();\nconsole.log(token); // short-lived JWT`, lang: "typescript" },
  Permissions: { title: "Check permissions", code: `const { allowed } = await client.checkPermission({\n  action: 'read',\n  resource: 'database/users',\n});\n\nif (!allowed) throw new Error('Denied');`, lang: "typescript" },
  "Agent Identity": { title: "How identity works", code: `// Each agent gets an Ed25519 key pair at creation.\n// Public key registered with AgentAuth.\n// Private key stays with the agent runtime.\n//\n// Short-lived tokens (5-15 min) are derived\n// from that identity for all API calls.`, lang: "typescript" },
  "Token Lifecycle": { title: "Token flow", code: `// 1. Agent requests challenge nonce\nconst challenge = await client.getChallenge();\n\n// 2. Agent signs nonce with private key\nconst signed = await client.sign(challenge.nonce);\n\n// 3. Exchange for JWT\nconst { token, expiresAt } = await client.exchange(signed);`, lang: "typescript" },
};

function CodeBlock({ title, code, lang }: { title: string; code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="rounded-2xl border border-hairline bg-surface/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
        <span className="text-xs text-muted-foreground font-mono">{title}</span>
        <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="p-5 text-sm font-mono text-foreground/80 overflow-x-auto leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

export default function DocsLandingPage() {
  const [activeItem, setActiveItem] = useState("Installation");
  const example = codeExamples[activeItem];

  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <div className="eyebrow mb-4 flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> Documentation</div>
          <h1 className="text-3xl sm:text-4xl">AgentAuth Documentation</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">Everything you need to integrate agent identity and permissions into your product.</p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <nav className="space-y-6">
            {sections.map((s) => (
              <div key={s.id}>
                <div className="eyebrow mb-2">{s.title}</div>
                <ul className="space-y-1">
                  {s.items.map((item) => (
                    <li key={item}>
                      <button
                        onClick={() => setActiveItem(item)}
                        className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                          activeItem === item ? "bg-foreground/5 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div>
            {example ? (
              <CodeBlock title={example.title} code={example.code} lang={example.lang} />
            ) : (
              <div className="rounded-2xl border border-hairline bg-surface/60 p-8 text-center">
                <p className="text-muted-foreground">Select a topic from the sidebar to see code examples.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
