import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const { signIn, signUp, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
            </div>
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
              type="submit" disabled={isLoading}
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
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(""); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
