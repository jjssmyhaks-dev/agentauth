import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Key, Eye, CheckCircle2, ArrowRight, Zap, Lock, Activity,
  Terminal, Users, FileCode2, Bell, ChevronRight, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

function Nav() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Shield className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">AgentAuth</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {["Product", "Docs", "Pricing", "Blog"].map((item) => (
            <a key={item} href="#" className="text-sm text-slate-400 transition-colors hover:text-white">
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10">
              Sign In
            </Button>
          </Link>
          <Link to="/auth">
            <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)]" />
      <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 bg-blue-600/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div variants={fadeUp}>
            <Badge variant="info" className="mb-6 px-4 py-1.5 text-xs">
              IDENTITY & PERMISSIONS FOR THE AGENT ERA
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Auth built for agents,{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              not humans.
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-6 text-lg text-slate-400 sm:text-xl">
            Give every AI agent a verifiable identity, scope exactly what it can touch,
            and decide — per agent, per action — whether it runs autonomously or waits for your approval.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25 px-8 text-base">
                Start Building <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white px-8 text-base">
              View Docs
            </Button>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-4 text-sm text-slate-500">
            Free to start. No credit card required.
          </motion.p>
        </motion.div>

        {/* Hero visual — animated auth flow diagram */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mx-auto mt-20 max-w-4xl"
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <div className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-slate-500">agent-auth-flow.ts</span>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {[
                { icon: Key, label: "Identity", desc: "Agent signs challenge with Ed25519 key", color: "from-blue-500 to-blue-600" },
                { icon: Shield, label: "Permissions", desc: "Check scoped grants for resource + action", color: "from-cyan-500 to-blue-500" },
                { icon: CheckCircle2, label: "Approval", desc: "Autonomous or human-in-the-loop decision", color: "from-emerald-500 to-cyan-500" },
              ].map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.2 }}
                  className="relative text-center"
                >
                  <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${step.color} shadow-lg`}>
                    <step.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">{step.label}</h3>
                  <p className="mt-1 text-xs text-slate-400">{step.desc}</p>
                  {i < 2 && (
                    <ChevronRight className="absolute right-[-16px] top-5 h-5 w-5 text-slate-600" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const problems = [
    { icon: Key, title: "No real agent identity", desc: "API keys get shared, copied, and forgotten. There's no durable, verifiable fingerprint per agent." },
    { icon: Lock, title: "All-or-nothing access", desc: "Coarse roles don't match how agents actually work. One agent, one resource, one action — that's the control you need." },
    { icon: Eye, title: "No visibility until something breaks", desc: "Without an audit trail, you find out what an agent did after the damage, not before." },
  ];

  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-white sm:text-4xl">
            Your agents are doing more.
            <br />
            <span className="text-slate-400">Your auth stack wasn't built for that.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-4 max-w-2xl text-slate-400">
            Traditional auth systems assume a human typing a password into a browser. Agents don't log in — they act, continuously, often without anyone watching.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="mt-16 grid gap-6 md:grid-cols-3"
        >
          {problems.map((p) => (
            <motion.div
              key={p.title}
              variants={fadeUp}
              className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition-colors hover:border-slate-700 hover:bg-slate-800/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{p.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    { num: "01", title: "Identity", desc: "Every agent gets a persistent cryptographic identity at creation — a key pair that's its permanent fingerprint. Short-lived signed tokens are issued from that identity for every call, so a leaked token expires in minutes, not forever.", icon: Key },
    { num: "02", title: "Permissions", desc: "Grant access down to the resource and the action: this agent can read this dataset, not write to it, not touch anything else. Time-boxed, usage-capped, revocable instantly.", icon: Shield },
    { num: "03", title: "Approval", desc: "Choose per agent, per user, or per action type whether it runs fully autonomous or waits for a human to approve. Deletes always need a nod. Reads can run free. You decide.", icon: CheckCircle2 },
    { num: "04", title: "Audit", desc: "Every token issued, every permission check, every approval decision — logged in a tamper-evident trail you can export, filter, and verify.", icon: Activity },
  ];

  return (
    <section className="relative py-24 bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_50%,rgba(59,130,246,0.08),transparent)]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-white sm:text-4xl">
            One layer. Full control.
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="mt-16 grid gap-8 md:grid-cols-2"
        >
          {steps.map((step) => (
            <motion.div
              key={step.num}
              variants={fadeUp}
              className="group relative rounded-xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-sm transition-all hover:border-blue-500/30 hover:bg-slate-800/60"
            >
              <div className="flex items-start gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 group-hover:bg-blue-600/20">
                  <step.icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-blue-400">{step.num}</span>
                    <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesGrid() {
  const features = [
    { icon: Key, title: "Cryptographic agent identity", desc: "Ed25519 key pairs, not shared secrets." },
    { icon: Shield, title: "Granular scoped permissions", desc: "Resource + action level, not roles." },
    { icon: CheckCircle2, title: "Configurable approval modes", desc: "Autonomous or human-in-the-loop." },
    { icon: Activity, title: "Tamper-evident audit log", desc: "Hash-chained, exportable, verifiable." },
    { icon: Zap, title: "Instant revocation", desc: "Cut off access the moment you need to." },
    { icon: Terminal, title: "Developer-first SDKs", desc: "TypeScript and Python, drop-in." },
    { icon: Users, title: "Live ops dashboard", desc: "See what agents are doing, right now." },
    { icon: Bell, title: "Webhooks", desc: "Notified the moment an approval is decided." },
  ];

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-white sm:text-4xl">
            Everything your agents need to act safely
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="group rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-all hover:border-slate-700 hover:bg-slate-800/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-400 group-hover:bg-blue-600/20">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-xs text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CodeExample() {
  const [copied, setCopied] = useState(false);
  const code = `import { AgentAuth } from 'agentauth-sdk';

const client = new AgentAuth({
  agentId: 'ag_01H8X9...',
  privateKey: readFileSync('agent_key.pem', 'utf8'),
  apiUrl: 'https://api.agentauth.com',
});

// Get a short-lived token
const token = await client.getToken();

// Submit an action — autonomous or pending approval
const result = await client.submitAction({
  resourceType: 'database',
  resource: 'customers_table',
  action: 'write',
  payload: { name: 'Acme Corp' },
});`;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-24 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} className="text-center text-3xl font-bold text-white sm:text-4xl">
            Integrate in minutes
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-4 max-w-xl text-center text-slate-400">
            Drop the SDK into your agent runtime. Get a token, check permissions, submit actions.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
                <span className="ml-2 text-xs text-slate-500">quickstart.ts</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="p-6 text-sm leading-relaxed text-slate-300 overflow-x-auto">
              <code>{code}</code>
            </pre>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function WhoItsFor() {
  const personas = [
    { icon: FileCode2, title: "Coding agent platforms", desc: "Your agents touch repos, run commands, and ship code. Scope exactly what they can do, and require approval before anything destructive.", color: "from-blue-500/15 to-cyan-500/15" },
    { icon: Users, title: "AI SDR & ops agents", desc: "Agents sending emails, updating CRMs, managing workflows — grant exactly the access they need, nothing more.", color: "from-emerald-500/15 to-blue-500/15" },
    { icon: Zap, title: "Platform engineering", desc: "Internal automation agents that manage infrastructure, deploy services, and monitor systems — with guardrails.", color: "from-amber-500/15 to-orange-500/15" },
  ];

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-white sm:text-4xl">
            Built for teams shipping real agent products
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="mt-16 grid gap-6 md:grid-cols-3"
        >
          {personas.map((p) => (
            <motion.div
              key={p.title}
              variants={fadeUp}
              className={`group rounded-xl border border-slate-800 bg-gradient-to-br ${p.color} p-6 backdrop-blur-sm transition-all hover:border-slate-700`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 text-blue-400">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{p.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="relative py-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(59,130,246,0.12),transparent)]" />
      <div className="relative mx-auto max-w-7xl px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-white sm:text-4xl">
            Ready to give your agents an identity?
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-4 max-w-xl text-slate-400">
            Start building with AgentAuth today. Free tier includes up to 10 agents and 100K token requests.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25 px-8 text-base">
                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-800 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">AgentAuth</span>
          </div>
          <div className="flex gap-6">
            {["Docs", "GitHub", "Discord", "Blog"].map((item) => (
              <a key={item} href="#" className="text-sm text-slate-500 transition-colors hover:text-white">
                {item}
              </a>
            ))}
          </div>
          <p className="text-xs text-slate-600">© 2025 AgentAuth. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Nav />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <FeaturesGrid />
        <CodeExample />
        <WhoItsFor />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
