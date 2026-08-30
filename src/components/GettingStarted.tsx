import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, KeyRound, CheckSquare, Activity, ArrowRight, X, Sparkles } from "lucide-react";

const steps = [
  { id: "agent", label: "Create your first agent", description: "Register an agent with a cryptographic identity", icon: Shield, href: "/dashboard/agents", done: false },
  { id: "grant", label: "Set up a permission grant", description: "Define what your agent can access", icon: KeyRound, href: "/dashboard/grants", done: false },
  { id: "approve", label: "Review your first approval", description: "Configure human-in-the-loop decisions", icon: CheckSquare, href: "/dashboard/approvals", done: false },
  { id: "audit", label: "Explore the audit log", description: "See tamper-evident activity tracking", icon: Activity, href: "/dashboard/activity", done: false },
];

export default function GettingStarted() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("aa_getting_started_dismissed") === "true"; } catch { return false; }
  });
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Check which steps are done based on dashboard state
  useEffect(() => {
    try {
      const hasAgents = localStorage.getItem("aa_getting_started_agents") === "true";
      const hasGrants = localStorage.getItem("aa_getting_started_grants") === "true";
      if (hasAgents) setCompletedSteps((prev) => new Set(prev).add("agent"));
      if (hasGrants) setCompletedSteps((prev) => new Set(prev).add("grant"));
    } catch { /* noop */ }
  }, []);

  const completed = completedSteps.size;
  const total = steps.length;
  const progress = (completed / total) * 100;

  if (dismissed || completed === total) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-2xl border border-hairline bg-surface/60 dark:bg-surface/40 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-medium">Getting Started</h3>
          <span className="text-xs text-muted-foreground">{completed}/{total} complete</span>
        </div>
        <button
          onClick={() => { setDismissed(true); localStorage.setItem("aa_getting_started_dismissed", "true"); }}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-muted mb-5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full bg-foreground"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {steps.map((step, i) => {
          const isDone = completedSteps.has(step.id);
          const Icon = step.icon;
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.08 }}
            >
              <Link
                to={step.href}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all group ${
                  isDone
                    ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                    : "border-hairline hover:border-foreground/20 hover:bg-surface/50"
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isDone ? "bg-green-500/15" : "bg-muted"
                }`}>
                  <Icon className={`h-4 w-4 ${isDone ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${isDone ? "text-green-700 dark:text-green-300 line-through" : ""}`}>{step.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>
                {!isDone && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
