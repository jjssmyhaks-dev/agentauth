import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import PublicLayout from "@/components/PublicLayout";
import { Shield, Key, Eye, Zap, Lock, Activity, Webhook, Code2, Brain, GitBranch, Globe } from "lucide-react";

const features = [
  { icon: Shield, title: "Ed25519 Agent Identity", desc: "Every agent gets a persistent cryptographic key pair at creation. The public key is registered with AgentAuth; the private key stays with the agent. Supports key rotation with grace periods.", tag: "Core" },
  { icon: Key, title: "Challenge-Response Auth", desc: "Agents prove identity by signing server-issued challenges. No static secrets, no API key sprawl. Short-lived JWTs expire in 5-15 minutes.", tag: "Core" },
  { icon: Zap, title: "Scoped Permissions", desc: "Grant access per resource + per action. Time-boxed, usage-capped, revocable instantly. Nothing is allowed by default — every access must be explicitly granted.", tag: "Core" },
  { icon: Eye, title: "Configurable Approval", desc: "Set per agent, per action, or per resource whether it runs autonomously or waits for human approval. Deletes always need a nod. Reads can run free.", tag: "Core" },
  { icon: Activity, title: "Tamper-Evident Audit", desc: "Every token issuance, permission check, approval decision, and action is logged. Each entry is SHA-256 hash-chained for tamper evidence.", tag: "Core" },
  { icon: Brain, title: "Dynamic Trust Scoring", desc: "Behavioral analysis scores each agent 0-100 based on IP changes, request volume, time-of-day patterns, and concurrent key usage. Trust level feeds into policy decisions.", tag: "Advanced" },
  { icon: Lock, title: "Instant Revocation", desc: "Revoke an agent or grant in milliseconds. All future token issuance for that scope is blocked immediately. No propagation delay.", tag: "Core" },
  { icon: Webhook, title: "HMAC-Signed Webhooks", desc: "Receive real-time events for approvals, revocations, and anomalies. HMAC-SHA256 signed with exponential backoff retry.", tag: "Integrations" },
  { icon: Code2, title: "Developer SDKs", desc: "TypeScript and Python SDKs handle token refresh, challenge signing, approval polling, and error handling. Drop-in integration.", tag: "Developer" },
  { icon: GitBranch, title: "Key Rotation", desc: "Rotate agent keys with a configurable grace period. Old and new keys work simultaneously during the transition window.", tag: "Security" },
  { icon: Globe, title: "Identity Graph", desc: "Visual map of agents → permissions → resources → owners. Answer 'what can this agent touch?' in one view.", tag: "Advanced" },
];

const tagColors: Record<string, string> = {
  Core: "bg-foreground/10 text-foreground",
  Advanced: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Security: "bg-red-500/10 text-red-600 dark:text-red-400",
  Integrations: "bg-green-500/10 text-green-600 dark:text-green-400",
  Developer: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

export default function FeaturesPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="eyebrow mb-4">Features</div>
          <h1 className="max-w-3xl text-4xl sm:text-5xl lg:text-6xl">Everything your agents need to act safely.</h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            From identity to audit, AgentAuth covers the full agent lifecycle with security, control, and visibility.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.04 }}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-hairline bg-surface/60 p-6 transition-shadow hover:shadow-lg hover:shadow-foreground/5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <f.icon className="h-5 w-5" />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tagColors[f.tag]}`}>{f.tag}</span>
              </div>
              <h3 className="text-lg font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">See how it all fits together.</p>
          <Link to="/auth" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-90">
            Try AgentAuth Free
          </Link>
        </motion.div>
      </div>
    </PublicLayout>
  );
}
