import { Link } from "react-router-dom";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

/* ── Content ─────────────────────────────────────────────────────────── */
const c = {
  nav: {
    links: [
      { label: "Product", href: "#product" },
      { label: "Docs", href: "#docs" },
      { label: "Pricing", href: "#pricing" },
      { label: "Blog", href: "#" },
    ],
    signIn: { label: "Sign In", href: "/auth" },
    cta: { label: "Get Started", href: "/auth" },
  },
  hero: {
    eyebrow: "Identity & permissions for the agent era",
    title: "Auth built for agents, not humans.",
    body: "Give every AI agent a verifiable identity, scope exactly what it can touch, and decide — per agent, per action — whether it runs autonomously or waits for your approval.",
    primaryCta: { label: "Start Building", href: "/auth" },
    secondaryCta: { label: "View Docs", href: "#docs" },
    supporting: "Free to start. No credit card required.",
  },
  problem: {
    heading: "Your agents are doing more. Your auth stack wasn't built for that.",
    body: "Traditional auth systems assume a human typing a password into a browser. Agents don't log in — they act, continuously, often without anyone watching. Bolting human-auth tools onto agent workflows leaves gaps: no durable agent identity, no fine-grained control over what an agent can touch, and no clean way to say \"let this run on its own\" versus \"check with me first.\"",
    cards: [
      { title: "No real agent identity", body: "API keys get shared, copied, and forgotten. There's no durable, verifiable fingerprint per agent." },
      { title: "All-or-nothing access", body: "Coarse roles don't match how agents actually work. One agent, one resource, one action — that's the level of control you need." },
      { title: "No visibility until something breaks", body: "Without an audit trail, you find out what an agent did after the damage, not before." },
    ],
  },
  howItWorks: {
    heading: "One layer. Full control.",
    steps: [
      { num: "01", title: "Identity", body: "Every agent gets a persistent cryptographic identity at creation — a key pair that's its permanent fingerprint. Short-lived signed tokens are issued from that identity for every call, so a leaked token expires in minutes, not forever." },
      { num: "02", title: "Permissions", body: "Grant access down to the resource and the action: this agent can read this dataset, not write to it, not touch anything else. Time-boxed, usage-capped, revocable instantly." },
      { num: "03", title: "Approval", body: "Choose per agent, per user, or per action type whether it runs fully autonomous or waits for a human to approve. Deletes always need a nod. Reads can run free. You decide." },
      { num: "04", title: "Audit", body: "Every token issued, every permission check, every approval decision — logged in a tamper-evident trail you can export, filter, and verify." },
    ],
  },
  features: {
    heading: "Everything your agents need to act safely",
    items: [
      { title: "Cryptographic agent identity", body: "Ed25519 key pairs, not shared secrets." },
      { title: "Granular scoped permissions", body: "Resource + action level, not roles." },
      { title: "Configurable approval modes", body: "Autonomous or human-in-the-loop, your call." },
      { title: "Tamper-evident audit log", body: "Hash-chained, exportable, verifiable." },
      { title: "Instant revocation", body: "Cut off an agent's access the moment you need to." },
      { title: "Developer-first SDKs", body: "TypeScript and Python, drop-in integration." },
      { title: "Live ops dashboard", body: "See what your agents are doing, right now." },
      { title: "Webhooks", body: "Get notified the moment an approval is decided." },
    ],
  },
  whoItsFor: {
    heading: "Built for teams shipping real agent products",
    cards: [
      { tag: "Coding Agent Platforms", title: "Ship code safely.", body: "Your agents touch repos, run commands, and ship code. Scope exactly what they can do, and require approval before anything destructive." },
      { tag: "AI SDR & Ops Agents", title: "Automate with guardrails.", body: "Agents sending emails, updating CRMs, and taking actions on behalf of your customers. Give each one a verifiable identity and a clean audit trail." },
      { tag: "Regulated Industries", title: "Built for compliance.", body: "Compliance teams need proof of what an agent did and under whose authority. AgentAuth's audit trail is built for exactly that conversation." },
    ],
  },
  codeSample: {
    heading: "A few lines to get started",
    code: `client = AgentAuthClient(agent_id, private_key)\ntoken = client.get_token()\nresult = client.submit_action(\n    "database", "customers_table", "write", payload\n)\n# Autonomous or pending approval — handled for you.`,
    caption: "TypeScript and Python SDKs.",
  },
  socialProof: {
    heading: "Trusted by teams building the next generation of agents",
  },
  pricing: {
    heading: "Start free. Scale as your agents do.",
    plans: [
      { name: "Developer", price: "Free", period: "", features: ["Up to 3 agents", "Community support", "Core identity & permissions API"], cta: "Start free" },
      { name: "Team", price: "$49", period: "/agent/mo", features: ["Unlimited agents", "Approval workflows", "Dashboard & webhooks", "Email support"], cta: "Start trial", highlighted: true },
      { name: "Enterprise", price: "Custom", period: "", features: ["SSO", "Dedicated audit retention", "Custom SLAs", "Priority support"], cta: "Contact sales" },
    ],
  },
  finalCta: {
    heading: "Give your agents an identity they can prove.",
    body: "Start free, integrate in minutes, and never wonder what your agents are doing again.",
    cta: { label: "Get Started Free", href: "/auth" },
  },
  footer: {
    columns: [
      { title: "Product", links: [{ label: "Features", href: "#product" }, { label: "Pricing", href: "#pricing" }, { label: "Docs", href: "#docs" }, { label: "Changelog", href: "#" }] },
      { title: "Developers", links: [{ label: "SDKs", href: "#docs" }, { label: "API Reference", href: "#docs" }, { label: "Status", href: "#" }] },
      { title: "Company", links: [{ label: "About", href: "#" }, { label: "Blog", href: "#" }, { label: "Contact", href: "#" }] },
      { title: "Legal", links: [{ label: "Privacy", href: "#" }, { label: "Terms", href: "#" }, { label: "Security", href: "#" }] },
    ],
  },
};

/* ── Reusable animation wrappers ────────────────────────────────────── */
function FadeIn({ children, className = "", delay = 0, y = 24 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StaggerContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

/* ── Helpers ─────────────────────────────────────────────────────────── */
function SectionLabel({ n, children }: { n: string; children: string }) {
  return <div className="flex items-center gap-3 eyebrow"><span className="tabular-nums">{n}</span><span>{children}</span></div>;
}

/* ── Live activity feed (real-time) ──────────────────────────────────── */
const feedData = [
  { agent: "Code Review Bot", action: "read", resource: "acme-corp/api-gateway", result: "allowed" },
  { agent: "SDR Outreach Agent", action: "write", resource: "crm/contacts/active", result: "allowed" },
  { agent: "Database Migration Agent", action: "delete", resource: "production/main", result: "pending" },
  { agent: "Customer Support Bot", action: "read", resource: "knowledge_base/faq", result: "allowed" },
  { agent: "Data Pipeline Agent", action: "write", resource: "analytics/warehouse", result: "pending" },
  { agent: "Security Scanner", action: "read", resource: "acme-corp/*", result: "denied" },
];

function ActivityFeed() {
  const [items, setItems] = useState(feedData.slice(0, 3));
  const idx = useRef(3);
  useEffect(() => {
    const i = setInterval(() => {
      setItems((prev) => [feedData[idx.current % feedData.length], ...prev].slice(0, 4));
      idx.current++;
    }, 3000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="rounded-2xl border border-hairline bg-surface/60 p-5 sm:p-6 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4"><span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" /><span className="eyebrow">Live activity</span></div>
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {items.map((item, i) => (
            <motion.div
              key={`${item.agent}-${i}-${idx.current}`}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1 - i * 0.15, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-xl bg-background/60 px-4 py-3 text-sm"
            >
              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${item.result === "allowed" ? "bg-green-500" : item.result === "pending" ? "bg-amber-500" : "bg-red-500"}`} />
              <span className="truncate"><span className="font-medium">{item.agent}</span> <span className="text-muted-foreground">{item.action}</span> <span className="text-muted-foreground font-mono text-xs">{item.resource}</span></span>
              <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${item.result === "allowed" ? "bg-green-500/15 text-green-600 dark:text-green-400" : item.result === "pending" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>{item.result}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Animated counters ───────────────────────────────────────────────── */
function Counter({ target, label }: { target: number; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = (ts: number) => { if (!start) start = ts; const p = Math.min((ts - start) / 1200, 1); setCount(Math.floor(p * target)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, [visible, target]);
  const display = target % 1 !== 0 ? count.toFixed(2) : count.toLocaleString();
  return <div ref={ref} className="text-center"><div className="text-3xl sm:text-4xl font-serif tabular-nums">{display}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></div>;
}

/* ── Animated auth flow diagram ──────────────────────────────────────── */
const flowNodes = [
  { label: "Agent", sub: "requests token", icon: "⟐" },
  { label: "Auth Engine", sub: "checks grants", icon: "◈" },
  { label: "Approval", sub: "autonomous / HITL", icon: "◉" },
];

interface FlowNodeData { label: string; sub: string; icon: string; }

function FlowNode({ node, active, index }: { node: FlowNodeData; active: boolean; index: number }) {
  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 + index * 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Glow */}
      <motion.div
        className="absolute -inset-3 rounded-3xl bg-foreground pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: active ? 0.05 : 0 }}
        transition={{ duration: 0.5 }}
      />
      {/* Card */}
      <motion.div
        className="relative flex h-20 w-28 flex-col items-center justify-center gap-1.5 rounded-2xl border border-hairline sm:h-24 sm:w-32"
        animate={{
          backgroundColor: active ? "var(--foreground)" : "var(--surface)",
          borderColor: active ? "var(--foreground)" : "var(--hairline)",
          scale: active ? 1.05 : 1,
        }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.span
          className="text-sm sm:text-base"
          animate={{ color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
          transition={{ duration: 0.4 }}
        >
          {node.icon}
        </motion.span>
        <motion.span
          className="font-medium text-xs sm:text-sm"
          animate={{ color: active ? "var(--primary-foreground)" : "var(--foreground)" }}
          transition={{ duration: 0.4 }}
        >
          {node.label}
        </motion.span>
        <motion.span
          className="text-[9px] sm:text-[10px] leading-tight text-center px-1"
          animate={{ color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
          transition={{ duration: 0.4 }}
        >
          {node.sub}
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

function FlowConnector({ active, index }: { active: boolean; index: number }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="relative h-px w-full max-w-12 sm:max-w-20">
        {/* Base line */}
        <div className="absolute inset-0 bg-hairline" />
        {/* Animated fill */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-foreground/40"
          initial={{ width: "0%" }}
          animate={{ width: active ? "100%" : "0%" }}
          transition={{ duration: 0.6, delay: active ? 0.1 : 0, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* Traveling dot */}
        {active && (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-foreground"
            initial={{ left: "0%" }}
            animate={{ left: ["0%", "100%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
    </div>
  );
}

function AuthFlowDiagram() {
  const [step, setStep] = useState(0);
  useEffect(() => { const i = setInterval(() => setStep((s) => (s + 1) % 3), 2800); return () => clearInterval(i); }, []);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Flow row */}
      <div className="flex w-full items-center justify-center gap-0">
        {flowNodes.map((node, i) => (
          <div key={node.label} className="flex items-center">
            <FlowNode node={node} active={step === i} index={i} />
            {i < flowNodes.length - 1 && <FlowConnector active={step >= i} index={i} />}
          </div>
        ))}
      </div>
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="rounded-full"
            animate={{
              width: step === i ? 20 : 6,
              height: 6,
              backgroundColor: step === i ? "var(--foreground)" : "var(--hairline)",
            }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────── */
const faqItems = [
  { q: "How does agent identity work?", a: "Every agent gets an Ed25519 key pair at creation. The public key is registered with AgentAuth; the private key stays with the agent. Short-lived JWT tokens are derived from that identity for all API calls." },
  { q: "What happens when a token is compromised?", a: "Tokens expire in 5-15 minutes by default. If a key is compromised, revoke the agent instantly — all future token issuance is blocked immediately." },
  { q: "Can I mix autonomous and HITL modes?", a: "Yes. Set the mode per agent, per org, or per action type. Reads can run autonomously while writes require human approval." },
  { q: "How does the audit trail work?", a: "Every token issuance, permission check, approval decision, and agent action is logged. Each entry is hash-chained to the previous one for tamper evidence." },
  { q: "Is there a free tier?", a: "Yes. The Developer tier is free forever with up to 3 agents and core identity & permissions API. No credit card required." },
];

function FAQItem({ item }: { item: { q: string; a: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-dashed border-hairline py-6 first:border-t-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between gap-6 text-left text-base sm:text-lg"
      >
        <span>{item.q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-muted-foreground text-xl leading-none"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Interactive Terminal ────────────────────────────────────────────── */
const terminalLines = [
  { type: "input", text: "$ agentauth agents create --name \"Code Review Bot\"" },
  { type: "output", text: "✓ Agent created: ag_x7k2m9p" },
  { type: "output", text: "  Public key: ed25519_pk_a1b2c3d4e5f6..." },
  { type: "input", text: "$ agentauth tokens request --agent ag_x7k2m9p" },
  { type: "output", text: "✓ Token issued (expires in 10min)" },
  { type: "input", text: "$ agentauth permissions check --action read --resource db/customers" },
  { type: "output", text: "✓ Allowed — grant gr_8n2k matched" },
  { type: "input", text: "$ agentauth actions submit --action delete --resource db/customers/123" },
  { type: "output-pending", text: "⏳ Pending approval — waiting for human review..." },
  { type: "output-approved", text: "✓ Approved by admin@acme.com" },
  { type: "output", text: "✓ Action executed successfully" },
];

function InteractiveTerminal() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!started) return;
    if (visibleLines >= terminalLines.length) return;
    const delay = terminalLines[visibleLines]?.type.startsWith("input") ? 800 : 400;
    const t = setTimeout(() => setVisibleLines((v) => v + 1), delay);
    return () => clearTimeout(t);
  }, [visibleLines, started]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [visibleLines]);

  return (
    <div className="rounded-2xl border border-hairline bg-surface/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
          <span className="ml-2 text-xs text-muted-foreground font-mono">terminal</span>
        </div>
        {!started && (
          <button onClick={() => { setStarted(true); setVisibleLines(1); }} className="rounded-full bg-foreground px-3 py-1 text-xs text-primary-foreground font-medium hover:opacity-90 transition-opacity">
            Run demo
          </button>
        )}
        {started && visibleLines >= terminalLines.length && (
          <button onClick={() => { setVisibleLines(0); setStarted(false); }} className="rounded-full border border-hairline px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Replay
          </button>
        )}
      </div>
      <div ref={ref} className="p-4 font-mono text-xs leading-relaxed h-72 overflow-y-auto">
        {visibleLines === 0 && !started && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Click "Run demo" to see the SDK in action
          </div>
        )}
        {terminalLines.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className={`${line.type === "input" ? "text-foreground" : line.type === "output-pending" ? "text-amber-600 dark:text-amber-400" : line.type === "output-approved" ? "text-green-600 dark:text-green-400" : "text-green-600 dark:text-green-400"}`}
          >
            {line.text}
          </motion.div>
        ))}
        {started && visibleLines < terminalLines.length && (
          <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }} className="inline-block h-3.5 w-2 bg-foreground/60" />
        )}
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const headerBg = useTransform(scrollYProgress, [0, 0.05], ["rgba(0,0,0,0)", resolvedTheme === "dark" ? "rgba(20,20,20,0.85)" : "rgba(237,234,227,0.85)"]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <motion.header
        style={{ backgroundColor: headerBg }}
        className="fixed inset-x-0 top-0 z-50 backdrop-blur-md px-3 py-3 sm:px-5 sm:py-4"
      >
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <nav className="hidden items-center gap-1 rounded-full bg-surface/60 px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur lg:flex">
            {c.nav.links.map((l) => (
              <a key={l.label} href={l.href} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">{l.label}</a>
            ))}
          </nav>
          <Link to="/" className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-surface/60 px-4 py-2 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur sm:px-5 sm:py-2.5 lg:mx-auto lg:max-w-sm lg:flex-none lg:grow-0 lg:basis-96">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-foreground" />AgentAuth
          </Link>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface/60 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur sm:pl-2">
            <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="rounded-full p-2 text-muted-foreground hover:text-foreground transition-colors" title="Toggle theme">
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/auth" className="hidden px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block">Sign In</Link>
            <Link to="/auth" className="whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-all hover:opacity-90 hover:shadow-md sm:px-4 sm:text-sm">Get Started</Link>
          </div>
        </div>
      </motion.header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[100rem] items-center gap-8 px-5 pb-16 pt-24 sm:gap-12 sm:px-6 sm:pb-24 sm:pt-36 md:grid-cols-2 md:gap-10 md:px-10 md:pt-44 lg:px-16 lg:pt-52">
        <div>
          <FadeIn delay={0.1}>
            <div className="eyebrow mb-6">{c.hero.eyebrow}</div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <h1 className="max-w-xl text-[2.5rem] leading-[1.05] tracking-tight sm:text-5xl md:text-[3.25rem] lg:text-[4.25rem] lg:leading-[1.02]">{c.hero.title}</h1>
          </FadeIn>
          <FadeIn delay={0.35}>
            <p className="mt-6 max-w-md font-serif text-lg leading-relaxed text-muted-foreground sm:mt-8 sm:text-xl">{c.hero.body}</p>
          </FadeIn>
          <FadeIn delay={0.5}>
            <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-12">
              <Link to={c.hero.primaryCta.href} className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg hover:shadow-foreground/10">{c.hero.primaryCta.label}</Link>
              <a href={c.hero.secondaryCta.href} className="border border-dashed border-hairline px-6 py-3 text-sm transition-all hover:bg-surface hover:border-foreground/20">{c.hero.secondaryCta.label}</a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{c.hero.supporting}</p>
          </FadeIn>
        </div>
        <FadeIn delay={0.3} y={16} className="-order-1 md:order-none">
          <AuthFlowDiagram />
        </FadeIn>
      </section>

      {/* Metrics */}
      <section className="py-12 sm:py-16 border-t border-dashed border-hairline">
        <div className="mx-auto max-w-[100rem] px-5 sm:px-6 md:px-10 lg:px-16">
          <StaggerContainer className="flex flex-wrap items-center justify-center gap-8 sm:gap-16 lg:gap-24">
            <Counter target={12847} label="Agents Protected" />
            <Counter target={2_400_000} label="Tokens Issued" />
            <Counter target={99.97} label="Uptime %" />
            <Counter target={340} label="Teams" />
          </StaggerContainer>
        </div>
      </section>

      {/* Problem */}
      <section id="product" className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <FadeIn>
            <h2 className="max-w-3xl text-[2rem] sm:text-4xl md:text-[2.5rem] lg:text-[3.25rem]">{c.problem.heading}</h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-6 max-w-2xl text-muted-foreground leading-relaxed">{c.problem.body}</p>
          </FadeIn>
          <StaggerContainer className="mt-10 grid gap-px overflow-hidden border border-hairline bg-hairline sm:mt-14 md:grid-cols-3">
            {c.problem.cards.map((card) => (
              <motion.article key={card.title} variants={staggerItem} className="bg-background p-6 sm:p-8 transition-colors hover:bg-surface/50">
                <h3 className="text-xl">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </motion.article>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* How It Works */}
      <section className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <FadeIn><SectionLabel n="02">How it works</SectionLabel></FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="mt-8 max-w-3xl text-[2rem] sm:text-4xl md:text-[2.5rem] lg:text-[3.25rem]">{c.howItWorks.heading}</h2>
          </FadeIn>
          <StaggerContainer className="mt-10 grid gap-px overflow-hidden border border-hairline bg-hairline sm:mt-14 md:grid-cols-2 lg:grid-cols-4">
            {c.howItWorks.steps.map((s) => (
              <motion.article key={s.num} variants={staggerItem} className="bg-background p-6 sm:p-8 transition-colors hover:bg-surface/50">
                <div className="eyebrow mb-6">{s.num} — {s.title}</div>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </motion.article>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Features */}
      <section className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <FadeIn>
            <h2 className="max-w-3xl text-[2rem] sm:text-4xl md:text-[2.5rem] lg:text-[3.25rem]">{c.features.heading}</h2>
          </FadeIn>
          <StaggerContainer className="mt-10 grid gap-px overflow-hidden border border-hairline bg-hairline sm:mt-14 md:grid-cols-2 lg:grid-cols-4">
            {c.features.items.map((f) => (
              <motion.article key={f.title} variants={staggerItem} className="bg-background p-6 sm:p-8 transition-colors hover:bg-surface/50">
                <h3 className="text-lg">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </motion.article>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Who It's For */}
      <section className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <FadeIn>
            <h2 className="max-w-3xl text-[2rem] sm:text-4xl md:text-[2.5rem] lg:text-[3.25rem]">{c.whoItsFor.heading}</h2>
          </FadeIn>
          <StaggerContainer className="mt-10 grid gap-px overflow-hidden border border-hairline bg-hairline sm:mt-14 md:grid-cols-3">
            {c.whoItsFor.cards.map((card) => (
              <motion.article key={card.title} variants={staggerItem} className="bg-background p-6 sm:p-8 transition-colors hover:bg-surface/50">
                <div className="eyebrow">{card.tag}</div>
                <h3 className="mt-6 text-xl">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </motion.article>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Code Sample */}
      <section className="rule-x">
        <div className="mx-auto grid max-w-[100rem] gap-10 px-5 py-16 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.4fr] md:px-10 lg:px-16 lg:py-24">
          <FadeIn>
            <div>
              <SectionLabel n="05">SDK</SectionLabel>
              <h2 className="mt-8 text-[2rem] leading-tight sm:text-3xl lg:text-[2.75rem]">{c.codeSample.heading}</h2>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div>
              <div className="rounded-2xl border border-hairline bg-surface/60 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-hairline">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
                  <span className="ml-2 text-xs text-muted-foreground font-mono">quickstart.py</span>
                </div>
                <pre className="p-6 text-sm font-mono text-foreground/80 overflow-x-auto leading-relaxed"><code>{c.codeSample.code}</code></pre>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{c.codeSample.caption} Full docs at <a href="#docs" className="underline hover:text-foreground">docs.agentauth.com</a>.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Interactive Terminal */}
      <section className="rule-x">
        <div className="mx-auto grid max-w-[100rem] gap-10 px-5 py-16 sm:px-6 sm:py-20 md:grid-cols-2 md:px-10 lg:px-16 lg:py-24">
          <FadeIn>
            <div>
              <SectionLabel n="04">Try it</SectionLabel>
              <h2 className="mt-8 text-[2rem] leading-tight sm:text-3xl lg:text-[2.75rem]">See it in action.</h2>
              <p className="mt-4 max-w-md text-muted-foreground leading-relaxed">Watch an agent authenticate, check permissions, and get approval — all in real time.</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <InteractiveTerminal />
          </FadeIn>
        </div>
      </section>

      {/* Social Proof */}
      <section className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 text-center sm:px-6 md:px-10 lg:px-16 lg:py-20">
          <FadeIn>
            <p className="eyebrow mb-8">{c.socialProof.heading}</p>
          </FadeIn>
          <StaggerContainer className="flex items-center justify-center gap-12 text-muted-foreground/40">
            {["Acme Corp", "TechFlow", "DataPilot", "AgentOps", "BuildAI"].map((n) => (
              <motion.span key={n} variants={staggerItem} className="text-lg font-medium transition-colors hover:text-muted-foreground/70">{n}</motion.span>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <FadeIn>
            <h2 className="text-center text-[2rem] sm:text-4xl md:text-[2.5rem] lg:text-[3.25rem]">{c.pricing.heading}</h2>
          </FadeIn>
          <StaggerContainer className="mt-12 grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {c.pricing.plans.map((plan) => (
              <motion.div
                key={plan.name}
                variants={staggerItem}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25 }}
                className={`rounded-2xl border p-6 sm:p-8 transition-shadow ${plan.highlighted ? "border-foreground bg-foreground text-primary-foreground shadow-xl shadow-foreground/10" : "border-hairline bg-surface/60 hover:shadow-lg hover:shadow-foreground/5"}`}
              >
                <h3 className="text-lg">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1"><span className="text-3xl font-serif">{plan.price}</span>{plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}</div>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f) => (<li key={f} className="flex items-start gap-2 text-sm"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" /><span className={plan.highlighted ? "text-primary-foreground/80" : "text-muted-foreground"}>{f}</span></li>))}
                </ul>
                <Link to="/auth" className={`mt-8 block w-full rounded-full py-2.5 text-center text-sm font-medium transition-all hover:opacity-90 hover:shadow-md ${plan.highlighted ? "bg-primary-foreground text-foreground" : "bg-foreground text-primary-foreground"}`}>{plan.cta}</Link>
              </motion.div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* FAQ */}
      <section className="rule-x">
        <div className="mx-auto grid max-w-[100rem] gap-10 px-5 py-16 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.4fr] md:px-10 lg:px-16 lg:py-24">
          <FadeIn><div><SectionLabel n="06">FAQ</SectionLabel><h2 className="mt-8 text-[2rem] leading-tight sm:text-4xl lg:text-[3rem]">Questions & answers.</h2></div></FadeIn>
          <FadeIn delay={0.1}><div>{faqItems.map((f) => (<FAQItem key={f.q} item={f} />))}</div></FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-24 text-center sm:px-6 md:px-10 lg:px-16 lg:py-32">
          <FadeIn>
            <h2 className="mx-auto max-w-3xl text-[2.25rem] leading-[1.08] sm:text-5xl lg:text-[4rem]">{c.finalCta.heading}</h2>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="mx-auto mt-6 max-w-md font-serif text-lg text-muted-foreground">{c.finalCta.body}</p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="mt-10"><Link to={c.finalCta.cta.href} className="rounded-full bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg hover:shadow-foreground/10">{c.finalCta.cta.label}</Link></div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-12 sm:px-6 md:px-10 lg:px-16 lg:py-16">
          <div className="grid grid-cols-2 gap-8 sm:gap-10 md:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-5"><span className="inline-block h-2 w-2 rounded-full bg-foreground" /><span className="font-medium">AgentAuth</span></div>
              <p className="text-sm text-muted-foreground leading-relaxed">Identity and permissions infrastructure for AI agents.</p>
            </div>
            {c.footer.columns.map((col) => (<div key={col.title}><div className="eyebrow">{col.title}</div><ul className="mt-5 space-y-2.5 text-sm">{col.links.map((l) => (<li key={l.label}><a href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">{l.label}</a></li>))}</ul></div>))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 rule-x pt-6 sm:mt-16 sm:gap-4 text-xs text-muted-foreground">
            <span>© 2025 AgentAuth. All rights reserved.</span>
            <div className="flex items-center gap-2"><span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />All systems operational</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
