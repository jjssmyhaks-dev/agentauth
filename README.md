# AgentAuth

**Identity, permissions, and audit platform purpose-built for AI agents.**

AgentAuth gives developers a complete identity layer for AI agents — cryptographic key-based authentication, granular grant/permission scoping, human-in-the-loop approvals, tamper-proof audit trails, and webhook delivery. Agents authenticate with public/private key pairs. Humans authenticate via Supabase Auth through a web dashboard.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Dashboard — Next.js 16 + React 19 + Tailwind CSS 4     │
│  / (landing) · /auth (Supabase login) · /dashboard/*     │
│  Agent registry · Grant builder · Approvals · Audit log  │
├──────────────────────────────────────────────────────────┤
│  API — NestJS 10 Modular Monolith (:4000)                │
│  Identity · Token · Grants · Approval · Audit            │
│  Webhooks · Notifications (Knock) · Orgs                 │
│  Policy Engine · Trust Scoring · Sessions · Fingerprints │
│  Key Rotation · Graph · Sync · AI Assistant              │
│  Swagger/OpenAPI at /docs · Sentry error tracking        │
├──────────────────────────────────────────────────────────┤
│  Data Layer                                              │
│  Timescale Cloud (PostgreSQL + TimescaleDB)              │
│  Redis Cloud (nonces, rate limiting, caching)            │
├──────────────────────────────────────────────────────────┤
│  Integrations                                            │
│  Supabase Auth (human login) · Knock (notifications)     │
│  Sentry (monitoring) · BullMQ-ready (webhook delivery)   │
├──────────────────────────────────────────────────────────┤
│  SDKs                                                    │
│  TypeScript (npm: agentauth-sdk) · Python (PyPI)         │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm
- A PostgreSQL database (Timescale Cloud, Supabase, or local)
- Redis instance (Redis Cloud or local)
- Supabase project (for human auth)
- Knock account (for notifications, optional)
- Sentry DSN (for monitoring, optional)

### 1. Clone and install

```bash
git clone https://github.com/jjssmyhaks-dev/agentauth.git
cd agentauth
npm install
```

### 2. Configure environment variables

Create `backend/.env`:

```env
# Database
DATABASE_URL=postgres://user:pass@host:5432/dbname?sslmode=require

# Redis
REDIS_URL=redis://default:password@host:port

# Supabase (human auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Knock (notifications)
KNOCK_API_KEY=your-knock-api-key
KNOCK_SIGNING_KEY=your-knock-signing-key

# Sentry (monitoring)
SENTRY_DSN=your-sentry-dsn
SENTRY_AUTH_TOKEN=your-sentry-auth-token
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run database migrations

```bash
cd backend
npm run migration:run
```

### 4. Start development

```bash
# From project root — starts both backend (:4000) and frontend (:3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard.
API docs available at [http://localhost:4000/docs](http://localhost:4000/docs).

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant root — org name, default approval mode |
| `users` | Human users — email, org membership, role |
| `agents` | AI agents — name, public key, status, approval override |
| `grants` | Permission grants — resource type/pattern, allowed actions, expiry, usage cap |
| `tokens_issued` | JWT issuance ledger — agent, JTI, scopes snapshot, expiry |
| `pending_approvals` | Human-in-the-loop queue — action, resource, decision |
| `audit_log` | Tamper-proof hash chain — actor, action, result, prev_hash, hash |
| `webhooks` | Event delivery — URL, event types, HMAC secret |
| `policies` | Policy engine rules — scope, trigger, condition, action, priority |
| `trust_scores` | Agent trust scoring — score, level, contributing factors |
| `trust_events` | Append-only trust signal log — event type, severity, delta |
| `sessions` | Continuous session verification — context fingerprint, status |
| `environment_fingerprints` | Agent environment identity — hash, trust status |
| `agent_keys` | Key rotation history — public key, status, grace period |
| `agent_attributes` | Custom key-value attributes per agent |
| `agent_groups` | Agent grouping with static membership or dynamic attribute filters |
| `sync_sources` | Directory sync connectors — generic webhook, LangChain, CrewAI |
| `sync_jobs` | Sync job status and results |
| `doc_embeddings` | AI assistant doc search (pgvector embeddings) |

All tables have row-level security (RLS) policies scoped by `org_id`.

---

## API Reference

Base URL: `http://localhost:4000/v1`

Full interactive docs: `GET /docs` (Swagger UI)

### Identity (Milestone 1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/agents` | Register an agent with Ed25519 public key |
| `GET` | `/v1/agents/:agent_id` | Get agent details |
| `POST` | `/v1/agents/:agent_id/rotate-key` | Rotate public key (5-min grace window) |
| `POST` | `/v1/agents/:agent_id/revoke` | Revoke an agent |

### Tokens (Milestone 1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/tokens/challenge?agent_id=` | Get a 60-second signed challenge nonce |
| `POST` | `/v1/tokens` | Exchange signed challenge for JWT (10-min TTL) |
| `GET` | `/.well-known/jwks.json` | Public JWKS for token verification |
| `POST` | `/v1/tokens/verify` | Verify a JWT's validity and claims |

### Grants & Permissions (Milestone 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/grants` | Create a permission grant |
| `GET` | `/v1/grants?agent_id=` | List grants for an agent |
| `PATCH` | `/v1/grants/:grant_id` | Narrow a grant (expiry/cap only, no widening) |
| `DELETE` | `/v1/grants/:grant_id` | Revoke a grant |
| `POST` | `/v1/permissions/check` | Evaluate a token against grants (sub-50ms) |

### Audit Log (Milestone 3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/audit/log` | Append to the hash-chained audit log |
| `GET` | `/v1/audit` | Paginated query with org/agent/date filters |
| `GET` | `/v1/audit/verify-chain` | Recompute hashes and detect tampering |
| `GET` | `/v1/audit/export?format=csv\|json` | Export audit log |

### Approvals (Milestone 4)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/approvals` | Create a pending approval request |
| `GET` | `/v1/approvals?org_id=&status=pending` | List pending approvals |
| `POST` | `/v1/approvals/:id/decide` | Approve or deny |
| `GET` | `/v1/approvals/:id` | Poll status (for agents) |
| `PATCH` | `/v1/orgs/:org_id/approval-policy` | Set default mode and action overrides |

### Webhooks (Milestone 7)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/webhooks` | Register webhook with event types |
| `GET` | `/v1/webhooks` | List webhooks |
| `DELETE` | `/v1/webhooks/:id` | Remove a webhook |
| `POST` | `/v1/webhooks/:id/test` | Send a test event |

Webhooks are delivered with HMAC-SHA256 signatures in `X-AgentAuth-Signature` headers and exponential backoff retry (up to 5 attempts).

### Policy Engine (#6)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/policies` | Create a policy rule (scope, trigger, condition, action) |
| `GET` | `/v1/policies?org_id=` | List all policies for an org |
| `PUT` | `/v1/policies/:id` | Update a policy |
| `DELETE` | `/v1/policies/:id` | Delete a policy |
| `POST` | `/v1/policies/simulate` | Simulate which policy fires for a hypothetical event |

### Trust Scoring (#1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/agents/:id/trust` | Get trust score (0-100, level, contributing factors) |
| `GET` | `/v1/agents/:id/trust/history` | Get trust event history |
| `POST` | `/v1/agents/:id/trust/events` | Record a trust event (new_ip, concurrent_key_use, etc.) |
| `POST` | `/v1/agents/:id/trust/decay` | Apply time-based score decay |

### Sessions (#3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/sessions?agent_id=&status=` | List sessions |
| `POST` | `/v1/sessions/:id/verify` | Verify request context matches session fingerprint |
| `POST` | `/v1/sessions/:id/revoke` | Emergency session revocation |

### Environment Fingerprints (#4)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/agents/:id/fingerprints` | Register an environment fingerprint |
| `GET` | `/v1/agents/:id/fingerprints` | List fingerprints |
| `POST` | `/v1/agents/:id/fingerprints/:id/trust` | Mark a fingerprint as trusted |
| `POST` | `/v1/agents/:id/fingerprints/verify` | Verify if an environment is trusted |

### Key Rotation (#5)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/agents/:id/keys` | Get key history |
| `POST` | `/v1/agents/:id/keys/rotate` | Rotate key with deprecation grace period (default 15 min) |
| `POST` | `/v1/agents/:id/keys/emergency-revoke` | Emergency revoke all keys (requires reason) |

### Identity Graph (#2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/graph?scope=agent:{id}` | Get identity graph as nodes + edges (React Flow ready) |

### Custom Attributes & Groups (#7)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/agents/:id/attributes` | Get custom attributes |
| `PUT` | `/v1/agents/:id/attributes` | Set/update attributes |
| `POST` | `/v1/groups` | Create agent group |
| `GET` | `/v1/groups?org_id=` | List groups |
| `POST` | `/v1/groups/:id/members/:agentId` | Add agent to group |

### External Agent Tier (#8)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PATCH` | `/v1/agents/:id/tier` | Set agent tier (internal/external) |

### Directory Sync (#10)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/sync/sources` | Create a sync source connector |
| `POST` | `/v1/sync/sources/:id/trigger` | Trigger a sync |
| `POST` | `/v1/sync/webhook/:sourceId` | Webhook to push agent metadata |
| `GET` | `/v1/sync/sources/:id/status` | Get sync job history |

### AI Assistant (#9)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/assistant/query` | Ask the AI assistant about agents, policies, or how to use the platform |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check with database connectivity |
| `GET` | `/docs` | Swagger/OpenAPI documentation |

---

## Token Flow

```
Agent                          AgentAuth API
  │                                 │
  │  1. GET /tokens/challenge       │
  │  ──────────────────────────────>│  Generate nonce, store in Redis (60s TTL)
  │  <──── { nonce, expires_at } ───│
  │                                 │
  │  2. Sign(nonce) with private key│
  │  POST /tokens                   │
  │  { agent_id, signed_nonce }     │
  │  ──────────────────────────────>│  Verify signature against stored public key
  │  <── { access_token, exp } ─────│  Issue RSA-2048 JWT (10-min default TTL)
  │                                 │
  │  3. Use JWT in Authorization    │
  │  Authorization: Bearer <token>  │
  │  ──────────────────────────────>│  Stateless JWT verification via JWKS
  │                                 │
  │  4. POST /permissions/check     │
  │  { action, resource }           │
  │  ──────────────────────────────>│  Evaluate against grants, check usage caps
  │  <── { allowed, grant_id } ─────│
```

---

## SDKs

### TypeScript (`agentauth-sdk`)

```typescript
import { AgentAuthClient } from 'agentauth-sdk';

const client = new AgentAuthClient({
  agentId: 'your-agent-id',
  privateKey: 'your-ed25519-private-key',
  baseUrl: 'https://your-api.com',
});

// Authenticate
const token = await client.getToken();

// Check permissions
const { allowed } = await client.checkPermission({
  action: 'read',
  resource: 'database/users/*',
});

// Submit an action (handles approval flow)
const result = await client.submitAction({
  action: 'write',
  resource: 'database/users/123',
  payload: { name: 'Updated' },
});
```

### Python (`agentauth`)

```python
from agentauth import AgentAuthClient

client = AgentAuthClient(
    agent_id="your-agent-id",
    private_key="your-ed25519-private-key",
    base_url="https://your-api.com",
)

# Authenticate
token = client.get_token()

# Check permissions
result = client.check_permission(action="read", resource="database/users/*")

# Submit an action
result = client.submit_action(
    action="write",
    resource="database/users/123",
    payload={"name": "Updated"},
)
```

Both SDKs handle:
- Transparent token refresh
- Challenge signing
- Approval flow polling (blocking or webhook callback)
- Typed error classes: `DeniedError`, `ExpiredGrantError`, `UsageCapReachedError`, `PendingApprovalTimeoutError`

---

## Project Structure

```
agentauth/
├── backend/                    # NestJS API server
│   ├── src/
│   │   ├── modules/
│   │   │   ├── identity/       # Agent registration, key rotation, revocation
│   │   │   ├── token/          # Challenge-nonce JWT minting
│   │   │   ├── grants/         # Permission grants CRUD + evaluation
│   │   │   ├── approval/       # Human-in-the-loop approval workflows
│   │   │   ├── audit/          # Hash-chained tamper-proof audit log
│   │   │   ├── webhooks/       # HMAC-signed webhook delivery
│   │   │   ├── notifications/  # Knock notification integration
│   │   │   └── orgs/           # Organization settings and policies
│   │   ├── common/
│   │   │   ├── dto/            # Request validation (class-validator)
│   │   │   ├── filters/        # Global exception filter (Sentry)
│   │   │   ├── guards/         # Org-scoped access guard
│   │   │   ├── middleware/     # Redis sliding-window rate limiter
│   │   │   └── redis/          # Redis connection module
│   │   ├── database/
│   │   │   ├── entities/       # TypeORM entity definitions
│   │   │   └── migrations/     # Production-safe schema migrations
│   │   ├── app.module.ts       # Root module
│   │   ├── app.controller.ts   # Health check, JWKS, API key endpoints
│   │   ├── main.ts             # Bootstrap with Sentry, Swagger, CORS
│   │   └── data-source.ts      # TypeORM CLI data source for migrations
│   └── test/                   # E2E tests
├── frontend/                   # Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Landing page
│   │   │   ├── auth/           # Supabase auth page
│   │   │   ├── dashboard/      # Protected dashboard pages
│   │   │   │   ├── page.tsx    # Overview with live stats
│   │   │   │   ├── agents/     # Agent registry
│   │   │   │   ├── grants/     # Grant/scope builder
│   │   │   │   ├── approvals/  # Approval queue (approve/deny)
│   │   │   │   ├── activity/   # Audit explorer with filters
│   │   │   │   ├── webhooks/   # Webhook configuration
│   │   │   │   ├── settings/   # Org settings
│   │   │   │   └── docs/       # SDK documentation
│   │   │   └── api/config/     # Runtime configuration endpoint
│   │   ├── components/
│   │   │   ├── dashboard/      # Sidebar, navigation
│   │   │   ├── error-boundary.tsx
│   │   │   └── loading-skeleton.tsx
│   │   └── lib/
│   │       ├── api.ts          # API client (proxied via Next.js rewrites)
│   │       └── supabase/       # Supabase browser client
│   └── config.json             # Runtime Supabase config fallback
├── sdk/                        # TypeScript SDK (npm: agentauth-sdk)
│   ├── src/index.ts
│   ├── package.json
│   └── tsconfig.json
├── sdk-python/                 # Python SDK (PyPI: agentauth)
│   ├── agentauth/
│   ├── pyproject.toml
│   └── setup.py
├── .github/workflows/
│   ├── ci.yml                  # Lint, typecheck, test on push/PR
│   ├── deploy.yml              # Build + deploy on merge to main
│   ├── publish-npm.yml         # TypeScript SDK release
│   └── publish-pypi.yml        # Python SDK release
└── package.json                # Root scripts (concurrently runs both)
```

---

## Development

### Backend

```bash
cd backend
npm install
npm run start:dev          # Watch mode on :4000
npm test                   # Run unit tests
npm run test:e2e           # Run e2e tests
npm run test:cov           # Coverage report
```

### Frontend

```bash
cd frontend
npm install
npm run dev                # Dev server on :3000
npm run build              # Production build
```

### Database Migrations

```bash
cd backend

# Generate migration from entity changes
npm run migration:generate -- src/database/migrations/MigrationName

# Run pending migrations
npm run migration:run

# Rollback last migration
npm run migration:revert
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Timescale Cloud recommended) |
| `REDIS_URL` | Yes | Redis connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (human auth) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (backend only) |
| `KNOCK_API_KEY` | No | Knock API key (notifications) |
| `KNOCK_SIGNING_KEY` | No | Knock signing key (notifications) |
| `SENTRY_DSN` | No | Sentry DSN (error tracking) |
| `SENTRY_AUTH_TOKEN` | No | Sentry auth token (source maps upload) |

---

## Security Features

- **Ed25519 key-based agent authentication** — agents prove identity by signing challenges, not by possessing static secrets
- **RSA-2048 JWT signing** — tokens are cryptographically signed and statelessly verifiable via JWKS
- **5-minute key rotation grace window** — agents can rotate keys without downtime
- **Hash-chained audit log** — SHA-256 chain (prev_hash + payload) detects any tampering
- **Row-level security** — all database tables are scoped by org_id
- **Redis rate limiting** — sliding-window rate limits on `/tokens` and `/permissions/check`
- **HMAC-SHA256 webhook signatures** — `X-AgentAuth-Signature` header for webhook verification
- **Input validation** — class-validator DTOs on all endpoints
- **CORS configuration** — configured for cross-origin dashboard access
- **Global exception filter** — all errors captured and sent to Sentry
- **Dynamic trust scoring** — rule-based behavioral scoring (new IP, concurrent key use, off-hours activity) with time-based decay
- **Policy engine** — configurable "if X then Y" rules per org/agent/group with simulate endpoint
- **Continuous session verification** — context fingerprints bound to tokens, mismatch detection
- **Environment fingerprinting** — verify agent execution environment matches registration
- **Key rotation with grace period** — 15-min deprecation window before old key expires
- **Identity graph** — visual agent→resource→permission relationships (React Flow)
- **AI assistant** — Gemini-powered chat for querying audit logs, policies, and docs
- **Directory sync** — generic webhook connector for importing agents from LangChain, CrewAI, etc.

---

## CI/CD

GitHub Actions workflows handle:

- **CI** (`ci.yml`) — Lint, typecheck, and test on every push/PR to main
- **Deploy** (`deploy.yml`) — Build and deploy on merge to main
- **SDK Release** — Triggered by git tags:
  - `sdk-v*` → publishes TypeScript SDK to npm
  - `sdk-python-v*` → publishes Python SDK to PyPI

---

## License

MIT
