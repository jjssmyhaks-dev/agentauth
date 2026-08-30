import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Support runtime config: values may have been injected by /api/config
  const url =
    (window as any).__SUPABASE_URL__ || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    (window as any).__SUPABASE_ANON_KEY__ || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    console.warn('Supabase not configured — auth will not work until env vars are set.');
  }

  return createBrowserClient(url, key);
}
