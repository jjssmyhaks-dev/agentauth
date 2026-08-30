import { motion } from "framer-motion";
import PublicLayout from "@/components/PublicLayout";

const sections = [
  { title: "Acceptance of Terms", content: "By accessing or using AgentAuth, you agree to these Terms. If you're using AgentAuth on behalf of an organization, you represent that you have authority to bind that organization." },
  { title: "Service Description", content: "AgentAuth provides identity, permission management, and audit logging infrastructure for AI agents. The service is provided 'as is' with the availability and features described on our pricing page." },
  { title: "Account Responsibilities", content: "You're responsible for maintaining the security of your account, API keys, and agent private keys. You must notify us immediately of any unauthorized access. You're responsible for all activity under your account." },
  { title: "Agent Identity & Keys", content: "Agent private keys are your responsibility. AgentAuth stores only public keys. If you lose a private key, you can revoke the agent and create a new one. We cannot recover lost private keys." },
  { title: "Acceptable Use", content: "You may not use AgentAuth to: circumvent security measures, impersonate other agents, abuse rate limits, reverse engineer the service, or use it for illegal purposes. We reserve the right to suspend accounts that violate these terms." },
  { title: "Pricing & Payment", content: "Free tier is provided at no cost. Paid plans are billed monthly. Prices may change with 30 days notice. Unused tokens do not roll over. Refunds are available within 14 days of initial purchase." },
  { title: "Limitation of Liability", content: "AgentAuth's liability is limited to the fees paid in the 12 months preceding the claim. We are not liable for indirect, incidental, or consequential damages. We are not liable for actions taken by your agents." },
  { title: "Termination", content: "You may terminate your account at any time. We may suspend or terminate accounts that violate these terms. Upon termination, your data will be exported and deleted within 30 days." },
];

export default function TermsPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="eyebrow mb-4">Terms of Service</div>
          <h1 className="text-3xl sm:text-4xl">Terms of Service.</h1>
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
