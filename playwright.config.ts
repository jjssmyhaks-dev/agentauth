import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "fs";

// Load .env.e2e (gitignored) when present — lets local runs pin a stable
// control-plane key without touching CI secrets. Format: KEY=value lines.
try {
  for (const line of readFileSync(".env.e2e", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  /* no .env.e2e — fine */
}

/**
 * Control-plane key for the E2E run. The backend ensures BOOTSTRAP_API_KEY
 * exists on boot (AuthService.ensureBootstrapKey), and the specs attach the
 * same value as Bearer. Overridable per environment via E2E_API_KEY
 * (e.g. a CI secret); the default below is a test-only throwaway, never
 * used outside the E2E backend instance.
 */
const E2E_KEY = process.env.E2E_API_KEY ?? "ak_e2e_local_bootstrap_0000000000000000";
// Propagate to the test workers (e2e/auth.ts reads it from process.env).
process.env.E2E_API_KEY = process.env.E2E_API_KEY ?? E2E_KEY;

const API_PORT = 4123;
const APP_PORT = 4173;

/**
 * E2E for the golden path: launch → sign in → onboarding (agent + grant +
 * approval mode) → dashboard → approve a request → audit trail.
 *
 * The dashboard runs against the real API when VITE_API_URL is set and the
 * backend answers /health (see src/lib/api-config.ts). This config starts
 * both servers; the backend needs Postgres + Redis, which CI provides as
 * service containers and locally `docker compose up db redis` provides.
 *
 * Run: npm run test:e2e   (browsers: npx playwright install chromium)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run start:dev --prefix backend",
      // Health lives OUTSIDE the /api global prefix (see backend/src/main.ts).
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: String(API_PORT),
        DATABASE_URL:
          process.env.E2E_DATABASE_URL ??
          "postgres://agentauth:agentauth@localhost:5432/agentauth",
        REDIS_URL: process.env.E2E_REDIS_URL ?? "redis://localhost:6379",
        NODE_ENV: "development",
        CORS_ORIGIN: `http://127.0.0.1:${APP_PORT}`,
        BOOTSTRAP_API_KEY: E2E_KEY,
      },
    },
    {
      command: `npm run dev -- --port ${APP_PORT}`,
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_API_URL: `http://127.0.0.1:${API_PORT}`,
      },
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
