'use client';

import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/dashboard/sidebar';
import Onboarding from '@/components/dashboard/onboarding';
import { agentsApi } from '@/lib/api';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains('dark');
    setDark(isDark);
    checkOnboarding();
  }, []);

  async function checkOnboarding() {
    // Check if user has dismissed onboarding
    const dismissed = localStorage.getItem('agentauth_onboarded');
    if (dismissed) {
      setCheckingOnboarding(false);
      return;
    }

    // Check if org has any agents
    try {
      const res = await agentsApi.list(ORG_ID);
      const agents = Array.isArray(res.data) ? res.data : [];
      if (agents.length === 0) {
        setShowOnboarding(true);
      }
    } catch {
      // If API is down, skip onboarding check
    } finally {
      setCheckingOnboarding(false);
    }
  }

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  if (!mounted) return null;

  return (
    <AuthGuard>
      <div className="min-h-screen flex bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div />
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg border border-hairline hover:bg-surface transition-colors text-sm"
                title="Toggle dark mode"
              >
                {dark ? '☀️' : '🌙'}
              </button>
            </div>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>

        {showOnboarding && (
          <Onboarding onComplete={() => {
            setShowOnboarding(false);
            localStorage.setItem('agentauth_onboarded', 'true');
          }} />
        )}
      </div>
    </AuthGuard>
  );
}
