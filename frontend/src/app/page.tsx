import Link from 'next/link';
import { Shield, Check, ArrowRight, Terminal, Code, Lock, Activity } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-gray-900" />
            <span className="text-lg font-semibold tracking-tight">AgentAuth</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900">How it works</a>
            <a href="https://docs.agentauth.com" className="hover:text-gray-900">Docs</a>
            <a href="https://github.com/jjssmyhaks-dev/agentauth" className="hover:text-gray-900">GitHub</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="text-sm text-gray-600 hover:text-gray-900">
              Sign in
            </Link>
            <Link
              href="/auth"
              className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-600 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Now in public beta
          </div>
          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-6">
            Identity and permissions
            <br />
            for AI agents
          </h1>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-lg">
            Purpose-built auth infrastructure for teams building autonomous agents.
            Cryptographic identities, scoped permissions, human-in-the-loop approvals,
            and a full audit trail — in one API.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Start building
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="https://docs.agentauth.com"
              className="inline-flex items-center gap-2 border border-gray-300 px-6 py-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      {/* Code example */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
            <div className="w-3 h-3 rounded-full bg-gray-700"></div>
            <div className="w-3 h-3 rounded-full bg-gray-700"></div>
            <div className="w-3 h-3 rounded-full bg-gray-700"></div>
            <span className="ml-2 text-xs text-gray-500 font-mono">quickstart.ts</span>
          </div>
          <pre className="p-6 text-sm font-mono text-gray-300 overflow-x-auto leading-relaxed">
            <code>{`import { AgentAuthClient } from "agentauth-sdk";

const client = new AgentAuthClient(
  "agent_01H8X9...",
  process.env.AGENT_PRIVATE_KEY!
);

// Get a short-lived token
const token = await client.getToken();

// Check permissions before acting
const { allowed } = await client.checkPermission(
  "database",
  "users/*",
  "read"
);

if (allowed) {
  // Execute the action
  await client.submitAction("database", "users/42", "write", {
    name: "Updated via agent"
  });
}`}</code>
          </pre>
        </div>
      </section>

      {/* Logos */}
      <section className="border-t border-gray-100 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-sm text-gray-400 text-center mb-8">
            Trusted by teams building agents at
          </p>
          <div className="flex items-center justify-center gap-12 text-gray-300">
            <span className="text-lg font-semibold">Acme Corp</span>
            <span className="text-lg font-semibold">TechFlow</span>
            <span className="text-lg font-semibold">DataPilot</span>
            <span className="text-lg font-semibold">AgentOps</span>
            <span className="text-lg font-semibold">BuildAI</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-gray-100 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-xl mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Everything your agents need to stay secure
            </h2>
            <p className="text-gray-600 text-lg">
              Stop building auth from scratch. AgentAuth handles identity,
              permissions, approvals, and audit logging out of the box.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Shield className="w-5 h-5" />}
              title="Cryptographic identities"
              description="Every agent gets an Ed25519 key pair at creation. Short-lived JWTs derived from that identity for all API calls."
            />
            <FeatureCard
              icon={<Lock className="w-5 h-5" />}
              title="Scoped permissions"
              description="Resource-level, action-specific grants with time windows and usage caps. No implicit access, ever."
            />
            <FeatureCard
              icon={<Activity className="w-5 h-5" />}
              title="Human-in-the-loop"
              description="Configure approval mode per agent or action type. Block critical actions for human review before execution."
            />
            <FeatureCard
              icon={<Code className="w-5 h-5" />}
              title="TypeScript & Python SDKs"
              description="Native client libraries that handle token refresh, permission checks, and approval flows. No raw HTTP needed."
            />
            <FeatureCard
              icon={<Terminal className="w-5 h-5" />}
              title="Tamper-evident audit"
              description="Append-only, hash-chained log of every token, permission check, and agent action. Verify integrity anytime."
            />
            <FeatureCard
              icon={<Check className="w-5 h-5" />}
              title="Sub-50ms permission checks"
              description="Redis-cached permission evaluation. Resource servers can check permissions inline without adding latency."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-gray-100 py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight mb-12 text-center">
            How it works
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <Step
              number="1"
              title="Register your agent"
              description="POST /v1/agents with your agent's public key. You get back an agent ID and status."
            />
            <Step
              number="2"
              title="Create permission grants"
              description="Define what resources and actions each agent can access, with optional time windows and usage caps."
            />
            <Step
              number="3"
              title="Agent gets a token"
              description="Agent signs a challenge with its private key, exchanges it for a short-lived JWT. Stateless verification."
            />
            <Step
              number="4"
              title="Check and execute"
              description="Resource servers call /v1/permissions/check before allowing actions. Everything is audit-logged."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-gray-100 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight mb-4 text-center">
            Simple, transparent pricing
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-lg mx-auto">
            Start free, scale with your agents. No per-seat pricing.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <PricingCard
              name="Starter"
              price="$0"
              period="forever"
              description="For prototyping and personal projects"
              features={[
                '3 agents',
                '100 permission checks / day',
                '7-day audit retention',
                'Community support',
              ]}
              cta="Start free"
              highlighted={false}
            />
            <PricingCard
              name="Pro"
              price="$49"
              period="/month"
              description="For teams shipping production agents"
              features={[
                'Unlimited agents',
                '100K permission checks / month',
                '90-day audit retention',
                'Webhook integrations',
                'Email support',
              ]}
              cta="Start 14-day trial"
              highlighted={true}
            />
            <PricingCard
              name="Enterprise"
              price="Custom"
              period=""
              description="For organizations with strict compliance needs"
              features={[
                'Everything in Pro',
                'Unlimited permission checks',
                'Unlimited audit retention',
                'SSO / SAML',
                'Dedicated support',
                'SLA guarantee',
              ]}
              cta="Contact sales"
              highlighted={false}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100 py-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Ready to secure your agents?
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Get started in minutes. No credit card required for the free tier.
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Create your account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5" />
                <span className="font-semibold">AgentAuth</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                Identity and permissions infrastructure for AI agents.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-gray-900">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-gray-900">How it works</a></li>
                <li><a href="/auth" className="hover:text-gray-900">Pricing</a></li>
                <li><a href="https://docs.agentauth.com" className="hover:text-gray-900">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-4">Developers</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="https://docs.agentauth.com" className="hover:text-gray-900">API Reference</a></li>
                <li><a href="https://docs.agentauth.com/sdk" className="hover:text-gray-900">TypeScript SDK</a></li>
                <li><a href="https://docs.agentauth.com/sdk-python" className="hover:text-gray-900">Python SDK</a></li>
                <li><a href="https://github.com/jjssmyhaks-dev/agentauth" className="hover:text-gray-900">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-900">Blog</a></li>
                <li><a href="#" className="hover:text-gray-900">Changelog</a></li>
                <li><a href="#" className="hover:text-gray-900">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-gray-900">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-between text-sm text-gray-400">
            <span>&copy; {new Date().getFullYear()} AgentAuth. All rights reserved.</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              All systems operational
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-medium mb-4">
        {number}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  highlighted,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`p-6 rounded-xl border ${
        highlighted
          ? 'border-gray-900 bg-gray-950 text-white'
          : 'border-gray-200'
      }`}
    >
      <h3 className="font-semibold mb-1">{name}</h3>
      <p className={`text-sm mb-4 ${highlighted ? 'text-gray-400' : 'text-gray-500'}`}>
        {description}
      </p>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-3xl font-bold">{price}</span>
        {period && (
          <span className={`text-sm ${highlighted ? 'text-gray-400' : 'text-gray-500'}`}>
            {period}
          </span>
        )}
      </div>
      <ul className="space-y-2 mb-6">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
            <span className={highlighted ? 'text-gray-300' : 'text-gray-600'}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/auth"
        className={`block w-full text-center py-2 rounded-lg text-sm font-medium transition-colors ${
          highlighted
            ? 'bg-white text-gray-900 hover:bg-gray-100'
            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
