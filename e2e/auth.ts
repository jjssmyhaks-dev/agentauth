import type { APIRequestContext, Page } from "@playwright/test";

/**
 * Control-plane auth for E2E.
 *
 * The backend requires `Authorization: Bearer ak_…` on org-scoped endpoints
 * (the x-org-id spoofing hole is closed). CI/ops set BOOTSTRAP_API_KEY so the
 * backend ensures that key exists on boot; the tests read it from the env and
 * attach it everywhere. A stable dev key can also live in .env.e2e (gitignored)
 * — loaded by playwright.config.ts.
 *
 * Priority: E2E_API_KEY env → BOOTSTRAP_API_KEY env → throw.
 */
export function requireApiKey(): string {
  const key = process.env.E2E_API_KEY || process.env.BOOTSTRAP_API_KEY;
  if (!key) {
    throw new Error(
      "No API key for E2E: set E2E_API_KEY (or BOOTSTRAP_API_KEY, which the backend ensures on boot).",
    );
  }
  return key;
}

/** GET/POST/DELETE against the backend with the bearer key attached. */
export function authedGet(request: APIRequestContext, url: string) {
  return request.get(url, { headers: { authorization: `Bearer ${requireApiKey()}` } });
}

export function authedPost(
  request: APIRequestContext,
  url: string,
  data: unknown,
) {
  return request.post(url, {
    data,
    headers: { authorization: `Bearer ${requireApiKey()}` },
  });
}

/**
 * Inject the key into every browser-originated API call (fetch uses init
 * headers we can extend) and seed localStorage so the dashboard's AuthContext
 * picks it up before the first page renders.
 */
export async function installBrowserAuth(page: Page, apiBaseUrl: string): Promise<void> {
  const key = requireApiKey();
  const origin = new URL(apiBaseUrl).origin;
  await page.addInitScript(
    ({ key, origin }) => {
      window.localStorage.setItem("aa_api_key", key);
      const realFetch = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url.startsWith(origin)) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has("authorization")) headers.set("authorization", `Bearer ${key}`);
          return realFetch(input, { ...init, headers });
        }
        return realFetch(input, init);
      };
    },
    { key, origin },
  );
}
