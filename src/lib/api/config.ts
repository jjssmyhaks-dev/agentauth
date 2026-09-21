/**
 * API configuration for the dashboard.
 *
 * The dashboard runs against the real AgentAuth API when VITE_API_URL is
 * provided (e.g. `VITE_API_URL=http://localhost:4000 npm run dev`) and the
 * backend answers /health. Without it — or when the backend is down — the
 * dashboard falls back to the built-in mock data source so the UI is always
 * explorable. See src/lib/dataSource.ts.
 */
interface ApiEnv {
  VITE_API_URL?: string;
  VITE_ORG_ID?: string;
}

const env = (import.meta.env ?? {}) as ApiEnv;

/** Base URL of the backend API (no trailing slash), or null to use mock data. */
export const API_BASE_URL: string | null = env.VITE_API_URL
  ? env.VITE_API_URL.replace(/\/+$/, "")
  : null;

/** Org header used by the API when scoping dashboard data.
 *
 * Defaults to a fixed, valid UUID so the backend can seed it on first
 * health check (uuid columns reject arbitrary strings). Override with
 * VITE_ORG_ID to point the dashboard at another org.
 */
export const DEFAULT_ORG_ID = env.VITE_ORG_ID || "00000000-0000-4000-8000-000000000001";

/** Probe the API health endpoint. Resolves false when unreachable. */
export async function probeApiHealth(
  baseUrl: string,
  timeoutMs = 2_000,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
      // Avoid caching a stale health answer across reloads.
      headers: { "cache-control": "no-cache" },
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "healthy" || body.status === "degraded";
  } catch {
    return false;
  }
}
