import { test, expect } from "@playwright/test";

/**
 * Golden path against the REAL backend (started by playwright.config.ts
 * together with the dashboard in API mode):
 *
 *   sign in → onboarding wizard (agent + grant) → approval request created
 *   via the backend API → approve it in the dashboard UI → decision lands in
 *   the backend audit log.
 *
 * The backend DB is empty on boot; the org referenced by the dashboard is
 * seeded by the first /health hit (which the webServer startup waits for).
 */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4123";
const ORG_ID = "00000000-0000-4000-8000-000000000001";

test.describe("golden path", () => {
  test("sign in → onboarding → approval decision → audit trail", async ({ page, request }) => {
    test.setTimeout(120_000);

    // ── 1. Landing + sign in ────────────────────────────────────────────
    await page.goto("/");
    await expect(page).toHaveTitle(/AgentAuth/i);
    await page.getByRole("link", { name: /get started/i }).first().click();
    await expect(page).toHaveURL(/\/auth/);
    await page.getByPlaceholder("you@company.com").fill("e2e@agentauth.dev");
    await page.getByPlaceholder("Enter your password").fill("e2e-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 });

    // ── 2. Onboarding wizard (auto-opens on first dashboard visit) ──────
    // Each Continue advances asynchronously in API mode (keygen + POST +
    // refetch), so wait for each step's unique heading before acting.
    const agentName = `e2e-agent-${Date.now().toString(36)}`;
    await expect(page.getByRole("heading", { name: /create your first agent/i })).toBeVisible();
    await page.getByPlaceholder("e.g., Code Review Bot").fill(agentName);
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2: grant (defaults: database / customers_table / read+write)
    await expect(page.getByRole("heading", { name: /set a grant/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 3: approval mode (defaults to human-in-the-loop)
    await expect(page.getByRole("heading", { name: /approval mode/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 4: done
    await expect(page.getByRole("heading", { name: /you're set/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /go to dashboard/i }).click();

    // ── 3. The agent really exists in the backend ───────────────────────
    const agentsResp = await request.get(`${API}/api/v1/agents?org_id=${ORG_ID}`);
    expect(agentsResp.ok()).toBeTruthy();
    const agents = (await agentsResp.json()) as Array<{ id: string; name: string }>;
    const agent = agents.find((a) => a.name === agentName);
    expect(agent, "agent registered through the dashboard should exist in the API").toBeTruthy();

    // ── 4. Create a pending approval for it (HITL flow) ─────────────────
    const approvalResp = await request.post(`${API}/api/v1/approvals`, {
      data: {
        agent_id: agent!.id,
        action: "write",
        resource: "customers_table",
        context: { source: "e2e" },
      },
    });
    expect(approvalResp.ok()).toBeTruthy();

    // The dashboard refetches on mutations, not on a timer — reload so the
    // provider pulls the fresh approval list from the API.
    await page.reload();

    // ── 5. Approve it in the UI ─────────────────────────────────────────
    // The sidebar link's accessible name includes the pending badge
    // ("Pending approvals: N") — match by regex inside the nav.
    const nav = page.getByRole("navigation", { name: "Dashboard sections" });
    await nav.getByRole("link", { name: /approvals/i }).click();
    await expect(page.getByText(agentName).first()).toBeVisible({ timeout: 15_000 });
    const pendingTab = page.getByRole("tab", { name: /^Pending \(\d+\)$/ });
    const countBefore = Number((await pendingTab.textContent())?.match(/\d+/)?.[0] ?? 0);
    expect(countBefore).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Approve", exact: true }).first().click();
    await expect(page.getByText("Request approved")).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => Number((await pendingTab.textContent())?.match(/\d+/)?.[0] ?? 0))
      .toBe(countBefore - 1);

    // ── 6. The decision landed in the backend audit log ─────────────────
    await expect
      .poll(async () => {
        const auditResp = await request.get(`${API}/api/v1/audit?org_id=${ORG_ID}&limit=50`);
        if (!auditResp.ok()) return false;
        // GET /v1/audit returns a paginated envelope: { data: [...], total, ... }
        const body = (await auditResp.json()) as { data?: Array<{ action: string; result: string }> };
        const rows = Array.isArray(body) ? body : (body.data ?? []);
        return rows.some((r) => r.action === "approval.approve" && r.result === "allowed");
      })
      .toBe(true);

    // ── 7. The dashboard's Activity page renders the audit stream ───────
    await page.getByRole("link", { name: "Audit Log", exact: true }).click();
    await expect(page.getByText("customers_table").first()).toBeVisible({ timeout: 15_000 });
  });
});
