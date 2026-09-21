import { defineConfig, devices } from "@playwright/test";

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
