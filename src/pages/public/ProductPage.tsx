import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Key, Eye, Zap, Lock, Activity, Bell, Webhook, Code2 } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const capabilities = [
  { icon: Shield, title: "Agent Identity", desc: "Ed25519 key pairs for every agent. Cryptographic proof of who they are." },
  { icon: Key, title: "Scoped Permissions", desc: "Resource + action level grants. Nothing allowed by default." },
  { icon: Eye, title: "Human-in-the-Loop", desc: "Configurable approval per agent, per action, per resource." },
  { icon: Lock, title: "Instant Revocation", desc: "Cut off any agent's access in milliseconds." },
  { icon: Activity, title: "Audit Trail", desc: "Hash-chained, tamper-evident log of every action." },
  { icon: Bell, title: "Notifications", desc: "Real-time alerts for approvals, revocations, and anomalies." },
  { icon: Webhook, title: "Webhooks", desc: "HMAC-signed event delivery with exponential backoff." },
  { icon: Zap, title: "Trust Scoring", desc: "Behavioral analysis detects compromised keys and unusual patterns." },
  { icon: Code2, title: "SDKs", desc: "TypeScript and Python SDKs. Integrate in minutes." },
];

export default function ProductPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="eyebrow mb-4">Product</div>
          <h1 className="max-w-3xl text-4xl sm:text-5xl lg:text-6xl">
            The identity layer your agents actually need.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            AgentAuth provides persistent cryptographic identities, granular permissions, configurable approval workflows, and tamper-evident audit logging — purpose-built for AI agents acting autonomously.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-px overflow-hidden border border-hairline bg-hairline sm:mt-20 md:grid-cols-3">
          {capabilities.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
              className="bg-background p-6 sm:p-8 transition-colors hover:bg-surface/50"
            >
              <c.icon className="h-5 w-5 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">Ready to give your agents verifiable identity?</p>
          <Link to="/auth" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-90">
            Start Building Free
          </Link>
        </motion.div>
      </div>
    </PublicLayout>
  );
}
