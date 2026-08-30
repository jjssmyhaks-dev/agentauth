import { motion } from "framer-motion";
import { Shield, Lock, Eye, Key, FileCheck, Server } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const practices = [
  { icon: Lock, title: "Encryption at Rest", desc: "All data encrypted with AES-256. Database-level encryption with customer-managed keys available for Enterprise." },
  { icon: Key, title: "Encryption in Transit", desc: "TLS 1.3 on all connections. Certificate pinning available for SDK connections." },
  { icon: Shield, title: "Ed25519 Cryptography", desc: "Agent identities use Ed25519 key pairs — the same algorithm used by SSH and Signal. Tokens signed with RSA-2048." },
  { icon: Eye, title: "Tamper-Evident Audit", desc: "Every audit entry is SHA-256 hash-chained. Any modification to the log is mathematically detectable." },
  { icon: FileCheck, title: "SOC 2 Compliance", desc: "Infrastructure runs on SOC 2 Type II certified providers. Annual audit报告 available for Enterprise customers." },
  { icon: Server, title: "Row-Level Security", desc: "PostgreSQL RLS policies enforce tenant isolation at the database level. No cross-tenant data leakage possible." },
];

const audits = [
  { name: "SOC 2 Type II", status: "In Progress", eta: "Q4 2026" },
  { name: "GDPR Compliant", status: "Active", eta: "" },
  { name: "CCPA Compliant", status: "Active", eta: "" },
  { name: "ISO 27001", status: "Planned", eta: "2027" },
];

export default function SecurityPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
          <div className="eyebrow mb-4">Security</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl">Security is not a feature. It's the foundation.</h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            AgentAuth is built security-first. Every design decision starts with "could this be exploited?" We publish our practices because transparency builds trust.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {practices.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
              className="rounded-2xl border border-hairline bg-surface/60 p-6"
            >
              <p.icon className="h-5 w-5 text-muted-foreground mb-4" />
              <h3 className="text-base font-medium">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-16">
          <h2 className="text-2xl font-serif mb-6">Compliance & Audits.</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {audits.map((a) => (
              <div key={a.name} className="rounded-xl border border-hairline bg-surface/60 p-4">
                <p className="text-sm font-medium">{a.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${a.status === "Active" ? "bg-green-500" : a.status === "In Progress" ? "bg-amber-500" : "bg-muted"}`} />
                  <span className="text-xs text-muted-foreground">{a.status}{a.eta ? ` — ${a.eta}` : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-16 max-w-2xl">
          <h2 className="text-2xl font-serif mb-4">Vulnerability disclosure.</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We welcome responsible security research. If you discover a vulnerability, please email <span className="font-mono text-foreground">security@agentauth.dev</span> with details. We aim to acknowledge within 24 hours and resolve critical issues within 72 hours. We offer bug bounties for qualifying reports.
          </p>
        </motion.div>
      </div>
    </PublicLayout>
  );
}
