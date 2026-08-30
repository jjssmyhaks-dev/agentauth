import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const plans = [
  {
    name: "Developer",
    price: "Free",
    period: "",
    desc: "For individual developers and side projects.",
    features: ["Up to 3 agents", "Core identity & permissions API", "50K tokens/month", "Community support", "Basic audit log (7 days)"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Team",
    price: "$49",
    period: "/agent/mo",
    desc: "For teams shipping production agent products.",
    features: ["Unlimited agents", "Approval workflows", "Dashboard & webhooks", "Trust scoring", "Full audit log (90 days)", "Email support", "Custom approval policies"],
    cta: "Start Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For organizations with compliance and scale requirements.",
    features: ["Everything in Team", "SSO / SAML", "Dedicated audit retention", "Custom SLAs", "Priority support", "On-premise deployment", "Custom integrations", "Dedicated account manager"],
    cta: "Contact Sales",
    highlighted: false,
  },
];

const faq = [
  { q: "How are agents counted?", a: "Each registered agent identity counts toward your plan. Revoked agents stop counting after 30 days." },
  { q: "What happens when I hit the token limit?", a: "Tokens are soft-capped. You'll get a warning at 80% usage. At 100%, new token requests queue instead of being rejected." },
  { q: "Can I switch plans at any time?", a: "Yes. Upgrades take effect immediately with prorated billing. Downgrades apply at the next billing cycle." },
  { q: "Do you offer discounts for nonprofits or open source?", a: "Yes. Contact us with your organization details and we'll work something out." },
];

export default function PricingPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="eyebrow mb-4">Pricing</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl">Start free. Scale as your agents do.</h1>
          <p className="mt-6 mx-auto max-w-xl text-lg text-muted-foreground">
            No credit card required. Pay only for what your agents use.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
              whileHover={{ y: -4 }}
              className={`rounded-2xl border p-6 sm:p-8 transition-shadow ${
                plan.highlighted
                  ? "border-foreground bg-foreground text-primary-foreground shadow-xl shadow-foreground/10"
                  : "border-hairline bg-surface/60 hover:shadow-lg"
              }`}
            >
              <h3 className="text-lg">{plan.name}</h3>
              <p className={`mt-1 text-sm ${plan.highlighted ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{plan.desc}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-serif">{plan.price}</span>
                {plan.period && <span className={`text-sm ${plan.highlighted ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{plan.period}</span>}
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted ? "text-primary-foreground/60" : "text-muted-foreground"}`} />
                    <span className={plan.highlighted ? "text-primary-foreground/80" : "text-muted-foreground"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/auth" className={`mt-8 block w-full rounded-full py-2.5 text-center text-sm font-medium transition-all hover:opacity-90 ${
                plan.highlighted ? "bg-primary-foreground text-foreground" : "bg-foreground text-primary-foreground"
              }`}>
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-24 max-w-2xl mx-auto">
          <h2 className="text-2xl font-serif text-center mb-8">Frequently asked questions.</h2>
          <div className="space-y-6">
            {faq.map((f) => (
              <div key={f.q} className="border-t border-dashed border-hairline pt-6">
                <h3 className="text-base font-medium">{f.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
