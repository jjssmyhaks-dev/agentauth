import { motion } from "framer-motion";
import PublicLayout from "@/components/PublicLayout";
import { Shield, Users, Globe, Target } from "lucide-react";

const values = [
  { icon: Shield, title: "Security First", desc: "Every design decision starts with: 'could this be exploited?' We build for the adversarial reality of autonomous agents." },
  { icon: Users, title: "Developer Experience", desc: "Integrate in minutes, not days. Our SDKs handle the complexity so you can focus on your product." },
  { icon: Globe, title: "Global by Default", desc: "Built for teams worldwide, with focused early outreach to India and APAC where agent adoption is accelerating fastest." },
  { icon: Target, title: "Agent-Native", desc: "Not human auth bolted onto agents. Purpose-built for the unique identity and permission challenges of autonomous AI." },
];

const stats = [
  { value: "12,847", label: "Agents Protected" },
  { value: "340+", label: "Teams" },
  { value: "99.97%", label: "Uptime" },
  { value: "2.4M", label: "Tokens Issued" },
];

export default function AboutPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
          <div className="eyebrow mb-4">About</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl">Building the identity layer for the agent era.</h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            AgentAuth was born from a simple observation: existing auth systems are built for humans typing passwords into browsers. AI agents don't log in — they act, continuously, often without anyone watching. They need their own identity infrastructure.
          </p>
        </motion.div>

        <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }} className="text-center">
              <div className="text-3xl font-serif">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 grid gap-px overflow-hidden border border-hairline bg-hairline sm:mt-24 md:grid-cols-2">
          {values.map((v, i) => (
            <motion.div key={v.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="bg-background p-6 sm:p-8">
              <v.icon className="h-5 w-5 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">{v.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-16 max-w-2xl">
          <h2 className="text-2xl font-serif">Our mission.</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Every AI agent deserves a verifiable identity. Every organization deserves to know exactly what their agents can do. And every action should leave a trail you can trust. That's what we're building.
          </p>
        </motion.div>
      </div>
    </PublicLayout>
  );
}
