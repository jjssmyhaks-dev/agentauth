'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Check if user has a Supabase session
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/config');
        const config = await res.json();

        if (!config.configured) {
          // Supabase not configured — allow access in dev mode
          setChecked(true);
          return;
        }

        // Try to get session from Supabase
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push('/auth?returnTo=' + encodeURIComponent(window.location.pathname));
          return;
        }

        setChecked(true);
      } catch {
        // If auth check fails, allow access (dev mode)
        setChecked(true);
      }
    };

    checkAuth();
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
