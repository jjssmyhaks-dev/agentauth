# AgentAuth

**Identity, permissions, and audit for AI agents.**

AgentAuth gives autonomous agents verifiable identities, scoped permissions, and a tamper-evident audit trail — so humans stay in the loop where it matters.

```
Agent signs a challenge with its private key → receives a short-lived RS256 JWT
→ every action is checked against fine-grained grants → sensitive actions wait
for human approval → everything lands in a hash-chained audit log.
```

## Repository layout

| Path | What it is |
|---|---|
| `src/` | **Dashboard** (Vite + React 19). Runs on rich mock data by default; point it at the backend with `VITE_API_URL` to go live (see [Running the dashboard against the API](#running-the-dashboard-against-the-api)). |
| `backend/` | **NestJS API** — the real engine: agent identity, RSA challenge-response token issuance, grants, approvals, hash-chained audit log, Redis nonces, rate limiting, OpenAPI docs at `/docs`. |
| `frontend/` | Next.js 16 dashboard (Supabase auth) — an alternative front end wired to the API. |
| `sdk/` | TypeScript SDK (`agentauth-sdk`). |
| `sdk-python/` | Python SDK (`agentauth`). |
| `e2e/` | Playwright end-to-end suite for the golden path. |
| `docs/` | Product docs and release notes. |

## Quickstart (full stack, ~5 minutes)

Prereqs: Docker, Node 22, npm.

```bash
# 1. Postgres + Redis
docker compose up -d db redis

# 2. Backend (reads env from backend/.env — see backend/.env.example)
cd backend && cp .env.example .env && npm ci && npm run start:dev
# → API on http://localhost:4000  ·  Swagger at http://localhost:4000/docs

# 3. Dashboard against the real API (new terminal)
cd .. && npm ci
VITE_API_URL=http://localhost:4000 npm run dev
# → Dashboard on http://localhost:5173, showing live API data
```

Without `VITE_API_URL` the dashboard runs in self-contained demo mode (mock data + realtime simulation) — same UI, no infrastructure.

## Running the dashboard against the API

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL, e.g. `http://localhost:4000`. When set **and** the backend answers `/health`, the dashboard runs in API mode: every mutation is sent to the API and state is refetched from it. Falls back to mock mode if the API is unreachable. |
| `VITE_ORG_ID` | Org scoping header (`x-org-id`). Defaults to a fixed UUID that the backend auto-seeds on first health check. |

Backend env contract: see `backend/.env.example` (database, Redis, JWT keys, CORS, Sentry, Knock). Note `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` — without them the backend generates an **ephemeral** RS256 keypair per boot, invalidating issued tokens across restarts.

## Development

All work happens on npm (no Bun required).

| Where | Command | What |
|---|---|---|
| root | `npm run dev` | Dashboard dev server (Vite) |
| root | `npm run typecheck` / `npm test` / `npm run build` | Typecheck · 27 unit tests · production build |
| root | `npm run test:e2e` | Playwright golden path (starts backend + dashboard; needs `docker compose up -d db redis` first) |
| backend | `npm run start:dev` / `npm test` / `npm run build` | API dev server · unit tests · build |
| frontend | `npm run dev` / `npm run build` | Next.js dashboard |

CI (`.github/workflows/ci.yml`) runs typecheck, unit tests, and builds for dashboard, backend, and frontend, plus the Playwright E2E with Postgres/Redis service containers on every push and PR to `main`.

## API surface (v1)

All routes are prefixed `/api`. Highlights:

```
POST /api/v1/agents                      register agent (org, name, PEM public key)
GET  /api/v1/agents?org_id=…             list agents
POST /api/v1/tokens/challenge?agent_id=… get a one-time nonce (60s TTL)
POST /api/v1/tokens                      exchange nonce + RSA signature for JWT
POST /api/v1/grants                      create scoped grant (pattern, actions, caps)
POST /api/v1/permissions/check          authorize action; returns requires_approval
POST /api/v1/approvals                   create pending approval (HITL flow)
POST /api/v1/approvals/:id/decide        approve | deny
GET  /api/v1/audit?org_id=…              query audit log
GET  /api/v1/audit/verify-chain          verify hash chain integrity
GET  /.well-known/jwks.json              JWKS for JWT verification
```

Full interactive docs: run the backend and open `/docs` (Swagger).

## SDKs

```ts
// TypeScript
import { AgentAuthClient } from "agentauth-sdk";
const client = new AgentAuthClient(agentId, privateKeyPem, "http://localhost:4000");
const token = await client.get_token();
const ok = await client.checkPermission("database", "customers_table", "read");
```

```python
# Python
from agentauth import AgentAuthClient
client = AgentAuthClient(agent_id, private_key_pem, api_url="http://localhost:4000")
token = client.get_token()
result = client.check_permission("database", "customers_table", "read")
```

The client keeps its **private key**; only the PEM **public key** is registered with AgentAuth. Challenges are signed with RSA-SHA256 (PKCS#1 v1.5) and verified server-side.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities. Highlights of the model: one-time challenge nonces (Redis, 60s TTL), short-lived RS256 JWTs with JWKS rotation-ready key ids, hash-chained audit entries, per-org rate limiting, and org-scoped data access.

## License

[MIT](LICENSE)
