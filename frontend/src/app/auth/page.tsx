'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';


export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [supabase, setSupabase] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch config at runtime (not build-time) so it works even if NEXT_PUBLIC_* vars
    // weren't available when Next.js compiled the page.
    fetch('/api/config')
      .then((r) => r.json())
      .then((config) => {
        if (config.configured) {
          // Inject runtime values so createClient() can read them
          if (config.supabaseUrl) {
            (window as any).__SUPABASE_URL__ = config.supabaseUrl;
            process.env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl };
          }
          if (config.supabaseAnonKey) {
            (window as any).__SUPABASE_ANON_KEY__ = config.supabaseAnonKey;
            process.env = { ...process.env, NEXT_PUBLIC_SUPABASE_ANON_KEY: config.supabaseAnonKey };
          }
          return import('@/lib/supabase/client');
        }
      })
      .then((mod) => {
        if (mod) setSupabase(mod.createClient());
      })
      .catch(() => {});
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Auth not configured. Add Supabase credentials in Settings → Environment.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for verification link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
            <span className="text-lg font-medium text-foreground">AgentAuth</span>
          </div>
          <h1 className="text-xl mb-1 text-foreground">
            {isSignUp ? 'Create your account' : 'Sign in to AgentAuth'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Start securing your AI agents today' : 'Welcome back. Manage your agents and permissions.'}
          </p>
        </div>
        <div className="bg-surface border border-hairline p-6">
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-hairline bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="you@company.com" required />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-hairline bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Enter your password" required minLength={6} />
            </div>
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
              {loading ? 'Loading...' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
          {!supabase && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
