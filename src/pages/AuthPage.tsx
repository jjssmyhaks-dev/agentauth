import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-amber-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

function PasswordChecklist({ password }: { password: string }) {
  const checks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "At least one uppercase letter", met: /[A-Z]/.test(password) },
    { label: "At least one number", met: /[0-9]/.test(password) },
    { label: "At least one special character", met: /[^A-Za-z0-9]/.test(password) },
  ];
  return (
    <div className="space-y-1.5">
      {checks.map((c) => (
        <div key={c.label} className="flex items-center gap-2 text-xs">
          {c.met ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
          <span className={c.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const { signIn, signUp, isLoading } = useAuth();
  const navigate = useNavigate();

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const isValidEmail = email.includes("@") && email.includes(".");
  const isFormValid = isValidEmail && password.length >= 6 && (!isSignUp || password.length >= 8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isValidEmail) { setError("Please enter a valid email address"); return; }
    if (isSignUp && password.length < 8) { setError("Password must be at least 8 characters"); return; }
    try {
      if (isSignUp) {
        await signUp(email, password, email.split("@")[0]);
      } else {
        await signIn(email, password);
      }
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
            <span className="text-lg font-medium">AgentAuth</span>
          </Link>
          <motion.h1
            key={isSignUp ? "signup" : "signin"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-2xl font-serif"
          >
            {isSignUp ? "Create your account" : "Sign in to AgentAuth"}
          </motion.h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignUp ? "Start securing your AI agents today" : "Welcome back. Manage your agents and permissions."}
          </p>
        </div>
        <motion.div
          className="rounded-2xl border border-hairline bg-surface/60 p-6 backdrop-blur-sm"
          whileHover={{ boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5">Email address</label>
              <motion.input
                whileFocus={{ scale: 1.01 }}
                transition={{ duration: 0.15 }}
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                placeholder="you@company.com" required
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5">Password</label>
              <motion.input
                whileFocus={{ scale: 1.01 }}
                transition={{ duration: 0.15 }}
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                placeholder="Enter your password" required minLength={6}
              />
              {isSignUp && password.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(strength.score / 5) * 100}%` }} transition={{ duration: 0.3 }} className={`h-full rounded-full ${strength.color}`} />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{strength.label}</span>
                  </div>
                  <PasswordChecklist password={password} />
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-hairline accent-foreground" />
              <span className="text-sm text-muted-foreground">Remember me</span>
            </label>
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 overflow-hidden"
                >
                  <p className="text-sm text-destructive">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              type="submit" disabled={isLoading || !isFormValid}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:shadow-lg hover:shadow-foreground/10 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Please wait...
                </span>
              ) : isSignUp ? "Create account" : "Sign in"}
            </motion.button>
          </form>
          <div className="mt-4 text-center">
            <button type="button" onClick={() => { setIsSignUp((prev) => !prev); setError(""); setPassword(""); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
