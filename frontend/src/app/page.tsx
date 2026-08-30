"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "framer-motion";

/* ── Data ─────────────────────────────────────────────── */

const navLinks = [
  { label: "Product", href: "#features" },
  { label: "Docs", href: "/dashboard/docs" },
  { label: "Pricing", href: "#pricing" },
];

const problems = [
  {
    icon: "🔐",
    title: "No real agent identity",
    body: "API keys get shared, copied, and forgotten. There's no durable, verifiable fingerprint per agent.",
  },
  {
    icon: "🎯",
    title: "All-or-nothing access",
    body: "Coarse roles don't match how agents actually work. One agent, one resource, one action — that's the level of control you need.",
  },
  {
    icon: "👁",
    title: "No visibility until something breaks",
    body: "Without an audit trail, you find out what an agent did after the damage, not before.",
  },
];

const steps = [
  {
    n: "01",
    title: "Identity",
    icon: "🔑",
    body: "Every agent gets a persistent cryptographic identity at creation — a key pair that's its permanent fingerprint. Short-lived signed tokens are issued from that identity for every call.",
    detail: "Ed25519 key pairs · RSA-2048 JWT · Token expiry in minutes",
  },
  {
    n: "02",
    title: "Permissions",
    icon: "🛡",
    body: "Grant access down to the resource and the action: this agent can read this dataset, not write to it, not touch anything else.",
    detail: "Resource + action level · Time-boxed · Usage-capped · Revocable",
  },
  {
    n: "03",
    title: "Approval",
    icon: "✅",
    body: "Choose per agent, per user, or per action type whether it runs fully autonomous or waits for a human to approve.",
    detail: "Autonomous or human-in-the-loop · Per-action overrides · Policy engine",
  },
  {
    n: "04",
    title: "Audit",
    icon: "📋",
    body: "Every token issued, every permission check, every approval decision — logged in a tamper-evident trail you can export, filter, and verify.",
    detail: "Hash-chained · Exportable · Verifiable · Real-time",
  },
];

const features = [
  { icon: "🔑", title: "Cryptographic agent identity", body: "Ed25519 key pairs, not shared secrets. Every agent gets a unique, verifiable identity." },
  { icon: "🎯", title: "Granular scoped permissions", body: "Resource + action level, not roles. Fine-grained control over what each agent can touch." },
  { icon: "🛡", title: "Configurable approval modes", body: "Autonomous or human-in-the-loop, your call. Per agent, per action, per resource." },
  { icon: "📋", title: "Tamper-evident audit log", body: "Hash-chained, exportable, verifiable. Complete trail of every action." },
  { icon: "⚡", title: "Instant revocation", body: "Cut off an agent's access the moment you need to. No delay, no downtime." },
  { icon: "📦", title: "Developer-first SDKs", body: "TypeScript and Python, drop-in integration. Get started in minutes." },
  { icon: "📊", title: "Live ops dashboard", body: "See what your agents are doing, right now. Real-time activity feed." },
  { icon: "🔔", title: "Webhooks", body: "Get notified the moment an approval is decided or an agent's access changes." },
];

const useCases = [
  {
    title: "Coding agent platforms",
    body: "Your agents touch repos, run commands, and ship code. Scope exactly what they can do, and require approval before anything destructive.",
    gradient: "from-blue-500/10 to-violet-500/10",
  },
  {
    title: "AI SDR & ops agents",
    body: "Agents sending emails, updating CRMs, and taking actions on behalf of your customers. Give each one a verifiable identity and a clean audit trail.",
    gradient: "from-emerald-500/10 to-teal-500/10",
  },
  {
    title: "Regulated industries",
    body: "Compliance teams need proof of what an agent did and under whose authority. AgentAuth's audit trail is built for exactly that conversation.",
    gradient: "from-amber-500/10 to-orange-500/10",
  },
];

const plans = [
  {
    name: "Developer",
    price: "Free",
    badge: null,
    features: ["Up to 3 agents", "Community support", "Core identity & permissions API"],
  },
  {
    name: "Team",
    price: "$12",
    unit: "/agent/mo",
    badge: "Most popular",
    features: ["Unlimited agents", "Approval workflows", "Dashboard & webhooks", "Email support"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    badge: null,
    features: ["SSO & SAML", "Dedicated audit retention", "Custom SLAs", "Priority support"],
  },
];

const stats = [
  { value: 99.9, suffix: "%", label: "Uptime SLA" },
  { value: 25, suffix: "+", label: "API endpoints" },
  { value: 50, suffix: "ms", label: "Avg latency" },
  { value: 4, suffix: "", label: "SDK languages" },
];

const footerCols = [
  { title: "Product", links: ["Features", "Pricing", "Docs", "Changelog"] },
  { title: "Developers", links: ["SDKs", "API Reference", "Status"] },
  { title: "Company", links: ["About", "Blog", "Contact"] },
  { title: "Legal", links: ["Privacy", "Terms", "Security"] },
];

/* ── Reusable Animation Variants ─────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

/* ── Components ───────────────────────────────────────── */

function SectionLabel({ n, children }: { n: string; children: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={fadeUp}
      className="flex items-center gap-3 eyebrow"
    >
      <span className="tabular-nums">{n}</span>
      <span>{children}</span>
    </motion.div>
  );
}

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value * 10) / 10);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {Number.isInteger(value) ? Math.round(display) : display.toFixed(1)}
      {suffix}
    </span>
  );
}

function ShimmerButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLAnchorElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  if (variant === "secondary") {
    return (
      <Link
        href={href}
        className="group relative overflow-hidden border border-dashed border-hairline px-6 py-3 text-sm transition-all duration-300 hover:border-foreground/30 hover:bg-surface"
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={handleMouseMove}
      className="group relative overflow-hidden rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all duration-300 hover:shadow-lg hover:shadow-foreground/10"
    >
      <span
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle 120px at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.15), transparent)`,
        }}
      />
      {children}
    </Link>
  );
}

function HeroDiagram() {
  const [step, setStep] = useState(0);
  const steps = ["Request", "Verify", "Grant", "Execute"];

  useEffect(() => {
    const interval = setInterval(() => setStep((s) => (s + 1) % steps.length), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mx-auto mt-12 max-w-2xl sm:mt-16">
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface/50 p-6 backdrop-blur-sm sm:p-8">
        {/* Flow diagram */}
        <div className="flex items-center justify-between gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 sm:gap-3">
              <motion.div
                animate={{
                  scale: step === i ? 1.1 : 1,
                  opacity: step === i ? 1 : 0.4,
                }}
                transition={{ duration: 0.3 }}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium sm:h-10 sm:w-10 sm:text-sm ${
                  step === i
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </motion.div>
              <span
                className={`hidden text-xs sm:inline ${
                  step === i ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s}
              </span>
              {i < steps.length - 1 && (
                <div className="mx-1 hidden h-px w-4 bg-hairline sm:mx-2 sm:block sm:w-8" />
              )}
            </div>
          ))}
        </div>

        {/* Active step detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="mt-6 rounded-lg border border-hairline bg-background/50 p-4"
          >
            <div className="font-mono text-xs text-muted-foreground">
              {step === 0 && (
                <>
                  <span className="text-green-600 dark:text-green-400">agent</span>
                  <span className="text-muted-foreground/50"> → </span>
                  <span className="text-foreground">POST /v1/tokens/mint</span>
                  <br />
                  <span className="text-muted-foreground/50">  {"{"}</span>
                  <span className="text-blue-600 dark:text-blue-400">"agent_id"</span>
                  <span className="text-muted-foreground/50">: "</span>
                  <span className="text-amber-600 dark:text-amber-400">ag_01H8...</span>
                  <span className="text-muted-foreground/50">"</span>
                  <span className="text-muted-foreground/50">{"}"}</span>
                </>
              )}
              {step === 1 && (
                <>
                  <span className="text-green-600 dark:text-green-400">system</span>
                  <span className="text-muted-foreground/50"> → </span>
                  <span className="text-foreground">Verify Ed25519 signature</span>
                  <br />
                  <span className="text-muted-foreground/50">  Check key fingerprint... </span>
                  <span className="text-green-600 dark:text-green-400">✓ valid</span>
                </>
              )}
              {step === 2 && (
                <>
                  <span className="text-green-600 dark:text-green-400">system</span>
                  <span className="text-muted-foreground/50"> → </span>
                  <span className="text-foreground">Evaluate permissions</span>
                  <br />
                  <span className="text-muted-foreground/50">  resource: </span>
                  <span className="text-blue-600 dark:text-blue-400">database.customers</span>
                  <span className="text-muted-foreground/50">  action: </span>
                  <span className="text-amber-600 dark:text-amber-400">read</span>
                  <span className="text-muted-foreground/50">  → </span>
                  <span className="text-green-600 dark:text-green-400">granted</span>
                </>
              )}
              {step === 3 && (
                <>
                  <span className="text-green-600 dark:text-green-400">system</span>
                  <span className="text-muted-foreground/50"> → </span>
                  <span className="text-foreground">Execute action</span>
                  <br />
                  <span className="text-muted-foreground/50">  Audit log entry </span>
                  <span className="text-green-600 dark:text-green-400">#1,547</span>
                  <span className="text-muted-foreground/50"> recorded</span>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Pulse indicator */}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Live — all checks pass in &lt;50ms
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  return (
    <motion.article
      ref={ref}
      variants={fadeUp}
      custom={index}
      onMouseMove={(e) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      className="group relative overflow-hidden bg-background p-6 transition-colors duration-300 hover:bg-surface/50 sm:p-8"
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle 150px at ${mousePos.x}px ${mousePos.y}px, rgba(0,0,0,0.03), transparent)`,
        }}
      />
      <div className="relative">
        <span className="text-2xl">{feature.icon}</span>
        <h3 className="mt-4 text-lg leading-snug">{feature.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {feature.body}
        </p>
      </div>
    </motion.article>
  );
}

function PricingCard({ plan, index }: { plan: typeof plans[0]; index: number }) {
  const isPopular = plan.badge === "Most popular";

  return (
    <motion.article
      variants={fadeUp}
      custom={index}
      className={`relative bg-background p-6 sm:p-8 ${
        isPopular ? "ring-2 ring-foreground/10" : ""
      }`}
    >
      {isPopular && (
        <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
          {plan.badge}
        </div>
      )}
      <div className="eyebrow">{plan.name}</div>
      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl">{plan.price}</span>
        {plan.unit && (
          <span className="text-sm text-muted-foreground">{plan.unit}</span>
        )}
      </div>
      <ul className="mt-6 space-y-3">
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2.5 text-sm text-muted-foreground"
          >
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link
          href="/auth"
          className={`block w-full rounded-full py-2.5 text-center text-sm font-medium transition-all duration-300 ${
            isPopular
              ? "bg-primary text-primary-foreground hover:shadow-lg hover:shadow-foreground/10"
              : "border border-dashed border-hairline hover:border-foreground/30 hover:bg-surface"
          }`}
        >
          {plan.price === "Free" ? "Start Free" : plan.price === "Custom" ? "Contact Sales" : "Get Started"}
        </Link>
      </div>
    </motion.article>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <nav className="hidden items-center gap-1 rounded-full bg-surface/80 px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur lg:flex">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-surface/80 px-4 py-2 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur sm:px-5 sm:py-2.5 lg:mx-auto lg:max-w-sm lg:flex-none lg:grow-0 lg:basis-96"
          >
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-foreground" />
            AgentAuth
          </Link>

          <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface/80 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur sm:pl-2">
            <Link
              href="/auth"
              className="hidden px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
            >
              Sign In
            </Link>
            <Link
              href="/auth"
              className="whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90 sm:px-4 sm:text-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative mx-auto max-w-[100rem] px-5 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-36 md:pt-44 lg:px-16 lg:pt-52">
        {/* Background decorative elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/[0.03] blur-3xl" />
          <div className="absolute -left-32 top-1/2 h-64 w-64 rounded-full bg-primary/[0.02] blur-3xl" />
        </div>

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative"
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="eyebrow mb-6"
          >
            Identity & Permissions for the Agent Era
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            custom={1}
            variants={fadeUp}
            className="max-w-3xl text-[2.5rem] leading-[1.05] tracking-tight sm:text-5xl md:text-[3.25rem] lg:text-[4.25rem] lg:leading-[1.02]"
          >
            Auth built for agents,{" "}
            <span className="relative">
              not humans.
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute -bottom-1 left-0 right-0 h-[3px] origin-left bg-foreground/20"
              />
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={2}
            variants={fadeUp}
            className="mt-6 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground sm:mt-8 sm:text-xl"
          >
            Give every AI agent a verifiable identity, scope exactly what it can
            touch, and decide — per agent, per action — whether it runs
            autonomously or waits for your approval.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            custom={3}
            variants={fadeUp}
            className="mt-8 flex flex-wrap items-center gap-3 sm:mt-12"
          >
            <ShimmerButton href="/auth">Start Building</ShimmerButton>
            <ShimmerButton href="/dashboard/docs" variant="secondary">View Docs</ShimmerButton>
          </motion.div>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={4}
            variants={fadeUp}
            className="mt-4 text-xs text-muted-foreground"
          >
            Free to start. No credit card required.
          </motion.p>
        </motion.div>

        {/* Hero animated diagram */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <HeroDiagram />
        </motion.div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-10 sm:px-6 md:px-10 lg:px-16">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
                className="text-center"
              >
                <div className="text-3xl font-medium tracking-tight sm:text-4xl">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <SectionLabel n="01">The Problem</SectionLabel>
          <div className="mt-8 grid gap-8 md:grid-cols-2 lg:mt-10 lg:gap-10">
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className="text-2xl leading-tight sm:text-3xl lg:text-[2.75rem]"
            >
              Your agents are doing more. Your auth stack wasn&apos;t built for that.
            </motion.h2>
            <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
              <motion.p
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
              >
                Traditional auth systems assume a human typing a password into a
                browser. Agents don&apos;t log in — they act, continuously, often
                without anyone watching. Bolting human-auth tools onto agent
                workflows leaves gaps.
              </motion.p>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={staggerContainer}
                className="grid gap-6 sm:grid-cols-3 mt-8"
              >
                {problems.map((p, i) => (
                  <motion.div
                    key={p.title}
                    variants={fadeUp}
                    custom={i}
                    className="space-y-3"
                  >
                    <span className="text-2xl">{p.icon}</span>
                    <h3 className="text-base font-medium text-foreground">{p.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <SectionLabel n="02">How It Works</SectionLabel>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeUp}
            className="mt-8 max-w-2xl text-[2rem] sm:text-4xl md:text-[2.5rem] lg:text-[3.25rem]"
          >
            One layer. Full control.
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="mt-10 grid gap-px sm:mt-16 overflow-hidden border border-hairline bg-hairline md:grid-cols-2"
          >
            {steps.map((s, i) => (
              <motion.article
                key={s.title}
                variants={scaleIn}
                className="group bg-background p-6 transition-colors duration-300 hover:bg-surface/30 sm:p-8"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div className="eyebrow">{s.n}</div>
                </div>
                <h3 className="mt-6 text-2xl leading-snug">{s.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
                <p className="mt-3 font-mono text-xs text-muted-foreground/60">
                  {s.detail}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <SectionLabel n="03">Features</SectionLabel>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeUp}
            className="mt-8 max-w-3xl text-[2rem] sm:text-4xl md:text-[2.5rem] lg:text-[3.25rem]"
          >
            Everything your agents need to act safely
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="mt-10 grid gap-px sm:mt-16 overflow-hidden border border-hairline bg-hairline md:grid-cols-2 lg:grid-cols-4"
          >
            {features.map((f, i) => (
              <FeatureCard key={f.title} feature={f} index={i} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Code Sample ── */}
      <section className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <SectionLabel n="04">Quick Start</SectionLabel>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeUp}
            className="mt-8 text-[2rem] sm:text-4xl md:text-[2.5rem] lg:text-[3.25rem]"
          >
            A few lines to get started
          </motion.h2>
          <CodeBlock />
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeUp}
            className="mt-4 text-sm text-muted-foreground"
          >
            TypeScript and Python SDKs. Full docs available in the dashboard.
          </motion.p>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <SectionLabel n="05">Who It&apos;s For</SectionLabel>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeUp}
            className="mt-8 max-w-3xl text-[2rem] sm:text-4xl md:text-[2.5rem] lg:text-[3.25rem]"
          >
            Built for teams shipping real agent products
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="mt-10 grid gap-px sm:mt-16 overflow-hidden border border-hairline bg-hairline md:grid-cols-3"
          >
            {useCases.map((u, i) => (
              <motion.article
                key={u.title}
                variants={fadeUp}
                custom={i}
                className={`group bg-background p-6 transition-colors duration-300 hover:bg-gradient-to-br ${u.gradient} sm:p-8`}
              >
                <h3 className="text-xl leading-snug">{u.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {u.body}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-16 sm:px-6 sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <SectionLabel n="06">Pricing</SectionLabel>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeUp}
            className="mt-8 text-[2rem] sm:text-4xl md:text-[2.5rem] lg:text-[3.25rem]"
          >
            Start free. Scale as your agents do.
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="mt-10 grid gap-px sm:mt-16 overflow-hidden border border-hairline bg-hairline md:grid-cols-3"
          >
            {plans.map((p, i) => (
              <PricingCard key={p.name} plan={p} index={i} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="rule-x">
        <div className="relative mx-auto max-w-[100rem] overflow-hidden px-5 py-24 text-center sm:px-6 md:px-10 lg:px-16 lg:py-32">
          {/* Background gradient orb */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[400px] w-[600px] rounded-full bg-primary/[0.04] blur-[100px]" />
          </div>

          <div className="relative">
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className="mx-auto max-w-3xl text-[2.25rem] leading-[1.08] sm:text-5xl lg:text-[4rem]"
            >
              Give your agents an identity they can prove.
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              custom={1}
              variants={fadeUp}
              className="mx-auto mt-6 max-w-md font-serif text-lg text-muted-foreground"
            >
              Start free, integrate in minutes, and never wonder what your agents
              are doing again.
            </motion.p>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              custom={2}
              variants={fadeUp}
              className="mt-10 flex flex-wrap justify-center gap-3"
            >
              <ShimmerButton href="/auth">Get Started Free</ShimmerButton>
              <ShimmerButton href="/dashboard/docs" variant="secondary">View Docs</ShimmerButton>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="rule-x">
        <div className="mx-auto max-w-[100rem] px-5 py-12 sm:px-6 md:px-10 lg:px-16 lg:py-16">
          <div className="grid grid-cols-2 gap-8 sm:gap-10 md:grid-cols-4">
            {footerCols.map((c) => (
              <div key={c.title}>
                <div className="eyebrow">{c.title}</div>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 rule-x pt-6 sm:mt-16 sm:gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
              </span>
              All systems normal
            </div>
            <div>&copy; AgentAuth. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Code Block Component ─────────────────────────────── */

function CodeBlock() {
  const [copied, setCopied] = useState(false);
  const code = `from agentauth import AgentAuthClient

client = AgentAuthClient(
    agent_id="ag_01H8X9...",
    private_key=open("agent_key.pem").read()
)

# Get a short-lived token
token = client.get_token()

# Submit an action — approval handled automatically
result = client.submit_action(
    resource_type="database",
    resource="customers_table",
    action="write",
    payload={"name": "Acme Corp", "email": "hi@acme.co"}
)

# result.status → "approved" | "pending_approval"`;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={fadeUp}
      className="mt-10 overflow-hidden border border-hairline"
    >
      <div className="flex items-center justify-between border-b border-hairline bg-surface/50 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
          <span>quickstart.py</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto bg-background p-6 text-sm leading-relaxed">
        <code>
          {code.split("\n").map((line, i) => {
            if (line.startsWith("#")) {
              return (
                <div key={i} className="text-muted-foreground/50">
                  {line}
                </div>
              );
            }
            if (line.includes("from ") || line.includes("import ")) {
              return (
                <div key={i}>
                  <span className="text-purple-600 dark:text-purple-400">{line.split(" ")[0]}</span>{" "}
                  <span className="text-foreground">{line.split(" ").slice(1).join(" ")}</span>
                </div>
              );
            }
            if (line.includes("=") && !line.includes("==") && !line.includes("open(")) {
              const parts = line.split("=");
              return (
                <div key={i}>
                  <span className="text-blue-600 dark:text-blue-400">{parts[0]}</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-amber-600 dark:text-amber-400">{parts.slice(1).join("=")}</span>
                </div>
              );
            }
            if (line.trim().startsWith('"') || line.trim().startsWith("'")) {
              return (
                <div key={i} className="text-amber-600 dark:text-amber-400">
                  {line}
                </div>
              );
            }
            return (
              <div key={i} className="text-foreground">
                {line}
              </div>
            );
          })}
        </code>
      </pre>
    </motion.div>
  );
}
