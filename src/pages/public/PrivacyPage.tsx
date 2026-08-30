import { motion } from "framer-motion";
import PublicLayout from "@/components/PublicLayout";

const sections = [
  { title: "Information We Collect", content: "We collect account information (email, name), agent metadata (identities, permissions, audit logs), and usage data (API calls, token issuance). We do not collect or store the content of agent actions — only the metadata about them." },
  { title: "How We Use Your Information", content: "To provide and maintain the AgentAuth service, process authentication requests, deliver audit logs, send notifications you've configured, and improve our product. We do not sell your data to third parties." },
  { title: "Data Storage & Security", content: "All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Audit logs are hash-chained for tamper evidence. We use row-level security to isolate tenant data. Infrastructure runs on SOC 2 compliant providers." },
  { title: "Data Retention", content: "Agent identities and audit logs are retained for the duration of your account. Free tier audit logs are retained for 7 days. Team plan: 90 days. Enterprise: configurable. Revoked agents' data is purged after 30 days." },
  { title: "Third-Party Services", content: "We use GitHub for code hosting, Vercel for hosting, and Stripe for payment processing. Each processes data under their own privacy policies. We do not share agent action content with any third party." },
  { title: "Your Rights", content: "You can export all your data at any time. You can delete your account and all associated data. You can request access to, correction of, or deletion of personal data under GDPR and CCPA." },
  { title: "Changes to This Policy", content: "We'll notify you of material changes via email at least 30 days before they take effect. The current policy is always available at agentauth.dev/privacy." },
];

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="eyebrow mb-4">Privacy Policy</div>
          <h1 className="text-3xl sm:text-4xl">Your data, your agents.</h1>
          <p className="mt-4 text-sm text-muted-foreground">Last updated: August 30, 2026</p>
        </motion.div>

        <div className="mt-12 space-y-10">
          {sections.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
              <h2 className="text-lg font-medium">{s.title}</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.content}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
