/**
 * Data-source resolution for the dashboard.
 *
 * Mode is decided once at startup:
 *  - "api"  — VITE_API_URL set AND the backend answers /health. All context
 *             mutations are sent to the API; state is refetched from it.
 *  - "mock" — no VITE_API_URL, or backend unreachable (dev/demo without
 *             infrastructure). The in-memory simulator experience is kept.
 *
 * The active mode is exposed on window for debugging:
 *   __AGENTAUTH_DATA_SOURCE__ === "api" | "mock"
 */
import { API_BASE_URL, probeApiHealth } from "@/lib/api/config";
import { createApiClient, type ApiClient } from "@/lib/api/client";

export type DataSourceMode = "api" | "mock";

interface Resolved {
  mode: DataSourceMode;
  client: ApiClient | null;
}

let resolved: Promise<Resolved> | null = null;

export function resolveDataSource(): Promise<Resolved> {
  if (!resolved) {
    resolved = (async () => {
      let mode: DataSourceMode = "mock";
      let client: ApiClient | null = null;
      if (API_BASE_URL && (await probeApiHealth(API_BASE_URL))) {
        // eslint-disable-next-line no-console
        console.info(`[agentauth] data source: api (${API_BASE_URL})`);
        mode = "api";
        const apiKey =
          typeof window !== "undefined" ? localStorage.getItem("aa_api_key") ?? undefined : undefined;
        client = createApiClient(API_BASE_URL, apiKey);
      } else if (API_BASE_URL) {
        // eslint-disable-next-line no-console
        console.warn(
          `[agentauth] VITE_API_URL=${API_BASE_URL} is set but the API is unreachable — falling back to mock data`,
        );
      }
      // Expose for debugging and for UI flows that branch on the mode
      // (e.g. real vs placeholder key generation at agent creation).
      if (typeof window !== "undefined") window.__AGENTAUTH_DATA_SOURCE__ = mode;
      return { mode, client };
    })();
  }
  return resolved;
}

declare global {
  interface Window {
    __AGENTAUTH_DATA_SOURCE__?: DataSourceMode;
  }
}

export async function getDataSourceMode(): Promise<DataSourceMode> {
  return resolveDataSource().then((r) => r.mode);
}
