import { useState } from "react";
import { motion } from "framer-motion";
import { Code2, ChevronRight } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const endpoints = [
  { method: "POST", path: "/v1/agents", desc: "Register an agent with Ed25519 public key", group: "Identity" },
  { method: "GET", path: "/v1/agents/:id", desc: "Get agent details and status", group: "Identity" },
  { method: "POST", path: "/v1/agents/:id/rotate-key", desc: "Rotate public key with grace period", group: "Identity" },
  { method: "POST", path: "/v1/agents/:id/revoke", desc: "Revoke an agent identity", group: "Identity" },
  { method: "GET", path: "/v1/tokens/challenge", desc: "Get a challenge nonce (60s TTL)", group: "Tokens" },
  { method: "POST", path: "/v1/tokens", desc: "Exchange signed challenge for JWT", group: "Tokens" },
  { method: "GET", path: "/.well-known/jwks.json", desc: "Public JWKS for token verification", group: "Tokens" },
  { method: "POST", path: "/v1/permissions/check", desc: "Evaluate a token against grants", group: "Permissions" },
  { method: "POST", path: "/v1/grants", desc: "Create a permission grant", group: "Grants" },
  { method: "GET", path: "/v1/grants", desc: "List grants for an agent", group: "Grants" },
  { method: "DELETE", path: "/v1/grants/:id", desc: "Revoke a grant", group: "Grants" },
  { method: "POST", path: "/v1/approvals", desc: "Create a pending approval request", group: "Approvals" },
  { method: "POST", path: "/v1/approvals/:id/decide", desc: "Approve or deny a request", group: "Approvals" },
  { method: "GET", path: "/v1/audit", desc: "Paginated audit log query", group: "Audit" },
  { method: "POST", path: "/v1/webhooks", desc: "Register a webhook endpoint", group: "Webhooks" },
];

const methodColors: Record<string, string> = {
  GET: "bg-green-500/15 text-green-600 dark:text-green-400",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
  PATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

const groups = [...new Set(endpoints.map((e) => e.group))];

export default function APIReferencePage() {
  const [activeGroup, setActiveGroup] = useState(groups[0]);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="eyebrow mb-4 flex items-center gap-2"><Code2 className="h-3.5 w-3.5" /> API Reference</div>
          <h1 className="text-3xl sm:text-4xl">REST API Reference</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Base URL: <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">https://api.agentauth.dev</code>
          </p>
        </motion.div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[200px_1fr]">
          <nav className="space-y-1">
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeGroup === g ? "bg-foreground/5 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </nav>

          <div className="space-y-2">
            {endpoints
              .filter((e) => e.group === activeGroup)
              .map((ep, i) => (
                <motion.div
                  key={ep.path}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="flex items-center gap-3 rounded-xl border border-hairline bg-surface/60 p-4 transition-colors hover:bg-surface/80"
                >
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold font-mono ${methodColors[ep.method]}`}>
                    {ep.method}
                  </span>
                  <code className="font-mono text-sm">{ep.path}</code>
                  <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">{ep.desc}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </motion.div>
              ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
