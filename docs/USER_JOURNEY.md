# AgentAuth — User Journey & Platform Walkthrough

## Overview

AgentAuth is an identity and permissions platform for AI agents. This document walks through every step a user takes — from landing page to production deployment — and explains how each feature works.

---

## Journey Map

```
Landing Page → Sign Up → Onboarding Wizard → Dashboard → Agent Lifecycle → Production
     ↓              ↓            ↓                  ↓              ↓              ↓
   Learn          Create      Set up first      Monitor &      Manage keys    Scale with
   about it       account     agent + grant     manage         & policies     policies
```

---

## Phase 1: Discovery & Sign Up

### 1.1 Landing Page (`/`)

**What the user sees:**
- Hero: "Auth built for agents, not humans" with animated auth flow diagram
- Problem section: why traditional auth fails for agents
- How It Works: 4-step flow (Identity → Permissions → Approval → Audit)
- Features grid: 8 core capabilities
- Code sample: Python SDK quickstart
- Pricing: Free / Team / Enterprise tiers
- CTA: "Start Building" → `/auth`

**User action:** Clicks "Start Building" or "Get Started"

### 1.2 Auth Page (`/auth`)

**What the user sees:**
- Clean sign-in/sign-up form with AgentAuth branding
- Email + password fields
- Toggle between "Sign in" and "Create account"
- Supabase warning if not configured

**User action:** Enters email + password, clicks "Create account"

**What happens:**
1. Supabase Auth creates the user account
2. User is redirected to `/dashboard`
3. Onboarding wizard auto-triggers (first-run detection)

---

## Phase 2: Onboarding Wizard

### 2.1 Step 1 — Create First Agent

**What the user sees:**
- "Create your first agent" heading
- Agent name input field
- "Managed by AgentAuth" toggle (auto-generate key pair)
- Submit button: "Create Agent"
- Skip button (bypass to dashboard)

**User action:** Types agent name (e.g., "Code Review Bot"), clicks "Create Agent"

**What happens:**
1. Backend generates Ed25519 key pair
2. Agent record created in database with `status: active`
3. Agent ID + public key displayed
4. Advances to Step 2

### 2.2 Step 2 — Set a Grant

**What the user sees:**
- "Set a grant" heading
- Resource type dropdown (database, repo, calendar, etc.)
- Resource pattern input (e.g., `customers_table`, `repo/*`)
- Action toggles: Read ✓ Write ✓ Delete ✗ Execute ✗
- Submit button: "Create Grant"

**User action:** Selects resource type, types pattern, toggles actions, clicks "Create Grant"

**What happens:**
1. Grant record created linking agent to resource+actions
2. Grant has no expiration by default (user can set one)
3. Advances to Step 3

### 2.3 Step 3 — Choose Approval Mode

**What the user sees:**
- Two large cards side by side:
  - **Autonomous ⚡** — "Agent runs freely without human approval"
  - **Human-in-the-loop 🛡️** — "Agent waits for your approval on sensitive actions"
- Submit button: "Continue"

**User action:** Selects one mode, clicks "Continue"

**What happens:**
1. Org-level default approval mode is set
2. Advances to Step 4

### 2.4 Step 4 — You're Set

**What the user sees:**
- "You're set" heading
- Agent ID displayed
- Approval mode summary
- Python SDK code snippet with copy button
- "Go to Dashboard" CTA

**User action:** Copies SDK code, clicks "Go to Dashboard"

**What happens:**
1. Onboarding marked complete in localStorage
2. User lands on Overview dashboard

---

## Phase 3: Dashboard — Day-to-Day Operations

### 3.1 Overview (`/dashboard`)

**What the user sees:**
- **Summary cards:** Active Agents, Pending Approvals, Actions Today, Audit Events Today
- **Live Activity Feed:** Real-time stream of agent actions (agent name, action, resource, result, timestamp)
- **Pending Approvals:** Top 3 pending items with Approve/Deny buttons

**User action:** Reviews activity, approves/denies pending requests

**Key interactions:**
- Click "Review" on pending approvals → goes to `/dashboard/approvals`
- Click "View all" on activity → goes to `/dashboard/activity`
- Summary cards link to relevant pages

### 3.2 Agents (`/dashboard/agents`)

**What the user sees:**
- Agent table: Name, Status, Approval Mode, Created, Actions
- "+ New Agent" button
- Search field
- Each agent row has: Rotate Key, Revoke buttons

**User actions:**

**Create a new agent:**
1. Click "+ New Agent"
2. Fill in name + public key (or toggle auto-generate)
3. Click "Create Agent"
4. Agent appears in table immediately

**View agent details:**
1. Click agent name → `/dashboard/agents/{id}`
2. See: public key, created date, approval mode, tier
3. Tabs: Overview, Grants, Activity
4. Overview tab: stats (tokens, actions, approvals, denials) + AI feedback
5. Grants tab: list of active grants for this agent
6. Activity tab: filtered audit log

**Rotate agent key:**
1. Click rotate icon on agent row
2. New key pair generated, old key deprecated with 15min grace period
3. Agent continues working with old key during grace period
4. After grace period, old key is fully revoked

**Revoke agent:**
1. Click revoke icon on agent row
2. Confirmation dialog: "This cannot be undone"
3. Agent status changes to `revoked`
4. All tokens issued to this agent are immediately invalid
5. All grants are suspended

### 3.3 Grants & Permissions (`/dashboard/grants`)

**What the user sees:**
- Grant table: Agent, Resource Type, Pattern, Actions, Expires, Usage, Status
- "+ New Grant" button
- Filter by agent / resource type / status

**User actions:**

**Create a grant:**
1. Click "+ New Grant"
2. Select agent (dropdown/search)
3. Enter resource type (e.g., "database")
4. Enter resource pattern (e.g., "customers_table" or "repo/*")
5. Select allowed actions (Read, Write, Delete, Execute)
6. Optional: set expiration date, usage cap
7. Click "Create Grant"

**Revoke a grant:**
1. Click "Revoke" on grant row
2. Grant status changes to `revoked`
3. Agent can no longer access that resource

**How grants work at runtime:**
1. Agent requests a token (SDK: `client.get_token()`)
2. Backend fetches all active grants for that agent
3. Grants are embedded in the JWT as scopes
4. When agent calls an API, middleware checks: does the token have a grant matching this resource+action?
5. If yes → allowed. If no → denied (or pending approval, depending on mode)

### 3.4 Approvals (`/dashboard/approvals`)

**What the user sees:**
- Tabs: Pending / Approved / Denied / All
- Pending list: each row shows agent name, requested action, resource, context, "waiting X minutes"
- Approve / Deny buttons on each pending item

**User actions:**

**Approve a request:**
1. Review the request details (agent, action, resource, context)
2. Click "Approve"
3. Request status changes to `approved`
4. Agent receives approval and can proceed

**Deny a request:**
1. Review the request details
2. Click "Deny"
3. Optional: enter reason (e.g., "This action requires additional review")
4. Request status changes to `denied`
5. Agent receives denial with reason

**How approvals work at runtime:**
1. Agent submits an action (SDK: `client.submit_action(...)`)
2. Backend checks approval mode:
   - **Autonomous:** Action executes immediately, logged to audit
   - **Human-in-the-loop:** Approval record created, status = `pending`
3. Pending approval appears on dashboard
4. Human approves/denies
5. Agent polls for decision (SDK handles this automatically)
6. Decision is returned to agent

### 3.5 Audit Log (`/dashboard/activity`)

**What the user sees:**
- Filters: Agent, Action type, Result (Allowed/Denied/Pending), Date range
- Table: Timestamp, Actor, Action, Resource, Result, Hash
- "Export" button (CSV/JSON)
- "Verify Chain Integrity" button

**User actions:**

**Filter audit log:**
1. Select agent from dropdown
2. Select action type
3. Select result filter
4. Set date range
5. Results update in real-time

**Export audit log:**
1. Click "Export"
2. Choose format (CSV or JSON)
3. File downloads

**Verify chain integrity:**
1. Click "Verify Chain Integrity"
2. System recomputes hash chain from first entry
3. Result: "Chain verified. All 1,523 entries are intact and unaltered."
4. Or: "Integrity check failed at entry [id]. This log may have been tampered with."

**How the audit trail works:**
- Every action is logged with: actor, action, resource, result, timestamp
- Each entry includes a SHA-256 hash of: previous hash + entry data
- This creates a tamper-evident chain (like a blockchain)
- If anyone modifies a past entry, the hash chain breaks
- Verification recomputes the entire chain to detect tampering

### 3.6 Analytics (`/dashboard/analytics`)

**What the user sees:**
- **Overview cards:** Total Tokens, Success Rate, Active Agents, Est. Cost
- **Token Usage Over Time:** Area chart (hourly buckets)
- **Actions Breakdown:** Stacked bar chart (allowed/denied/pending)
- **Agent Performance Table:** Name, Health badge, Tokens, Actions, Success %, "Analyze" button
- **AI Feedback Panel:** Health status, metrics, token trend, warnings, suggestions
- **Token Usage by Agent:** Horizontal bar chart

**User actions:**

**View time-series data:**
1. Select time range (24h / 7 days / 30 days)
2. Charts update automatically
3. Hover over data points for details

**Get AI feedback on an agent:**
1. Click "Analyze" on agent row in performance table
2. AI Feedback panel shows:
   - Health status (healthy/warning/critical)
   - Key metrics (tokens, success rate, denial rate, latency)
   - Token trend (up/down vs prior 24h)
   - Warnings (if any)
   - Improvement suggestions

**What the AI feedback analyzes:**
- High denial rate → "Review the agent's grants"
- Token usage spike → "Investigate whether this is expected"
- Token usage drop → "Agent may be offline"
- Low activity → "Check SDK configuration"
- Good health → "Performing well"

### 3.7 Webhooks (`/dashboard/webhooks`)

**What the user sees:**
- Webhook table: URL, Event Types, Status, Last Delivery, Actions
- "+ Add Webhook" button

**User actions:**

**Add a webhook:**
1. Click "+ Add Webhook"
2. Enter endpoint URL (e.g., `https://your-app.com/webhooks/agentauth`)
3. Select event types: approval.decided, agent.revoked, grant.revoked, agent.created
4. Secret is auto-generated (HMAC-SHA256)
5. Click "Add Webhook"
6. Click "Send Test Event" to verify

**How webhooks work:**
- When an event occurs (approval decided, agent revoked, etc.)
- AgentAuth sends an HTTP POST to your webhook URL
- Payload includes: event type, timestamp, full object data
- Headers include: `X-AgentAuth-Signature` (HMAC-SHA256 of payload)
- You verify the signature using the shared secret
- Retries with exponential backoff on failure

### 3.8 API Keys (`/dashboard/api-keys`)

**What the user sees:**
- API key table: Name, Key prefix, Created, Last Used, Status
- "+ New API Key" button

**User actions:**

**Create an API key:**
1. Click "+ New API Key"
2. Enter name (e.g., "Production Backend")
3. Click "Generate Key"
4. **One-time reveal:** Full key shown once, copy it now
5. Key appears in table with prefix (e.g., `aa_live_••••1234`)

**Revoke an API key:**
1. Click "Revoke" on key row
2. Key is immediately invalidated
3. Any requests using this key will fail

### 3.9 SDK Docs (`/dashboard/docs`)

**What the user sees:**
- Tab switcher: TypeScript / Python
- Sidebar nav: Install, Setup, Get Token, Check Permission, Submit Action
- Code blocks with copy-to-clipboard
- OpenAPI docs link

**User actions:**
1. Select language (TypeScript or Python)
2. Follow step-by-step integration guide
3. Copy code snippets
4. Click "OpenAPI Docs" to see full API reference at `/docs`

### 3.10 Settings (`/dashboard/settings`)

**What the user sees:**
- **Organization:** Name, logo upload
- **Default Approval Policy:** Mode selector (Autonomous / HITL), per-action overrides
- **Token Settings:** TTL slider (5-60 min)
- **Security:** IP allowlist
- **Danger Zone:** Revoke all agents, Delete org (requires typed confirmation)

**User actions:**
- Change org name
- Set default approval mode
- Adjust token TTL
- Configure IP allowlist
- Danger zone actions (with confirmation modal)

---

## Phase 4: Developer Integration (SDK Usage)

### 4.1 TypeScript SDK

```typescript
import { AgentAuth } from 'agentauth-sdk';

// Initialize
const client = new AgentAuth({
  agentId: 'ag_01H8X9...',
  privateKey: fs.readFileSync('agent_key.pem', 'utf8'),
  apiUrl: 'https://api.agentauth.com',
});

// Get a short-lived token
const token = await client.getToken();

// Submit an action (autonomous or pending approval)
const result = await client.submitAction({
  resourceType: 'database',
  resource: 'customers_table',
  action: 'write',
  payload: { name: 'Acme Corp' },
});

// result.status → "approved" | "pending_approval"
// result.approvalId → ID to poll for decision
```

### 4.2 Python SDK

```python
from agentauth import AgentAuthClient

client = AgentAuthClient(
    agent_id="ag_01H8X9...",
    private_key=open("agent_key.pem").read(),
    api_url="https://api.agentauth.com"
)

# Get token
token = client.get_token()

# Submit action
result = client.submit_action(
    resource_type="database",
    resource="customers_table",
    action="write",
    payload={"name": "Acme Corp"}
)

# result.status → "approved" | "pending_approval"
```

### 4.3 Token Flow

```
Agent                    AgentAuth                   Resource
  |                          |                          |
  |-- 1. Request challenge ->|                          |
  |<-- nonce (60s TTL) ------|                          |
  |                          |                          |
  |-- 2. Sign nonce with -->|                          |
  |   private key            |                          |
  |                          |                          |
  |-- 3. Exchange for JWT -->|                          |
  |   (signed challenge)     |                          |
  |<-- JWT token (10m TTL) --|                          |
  |                          |                          |
  |-- 4. Call API with JWT ->|---- 5. Verify JWT ------>|
  |                          |<-- 6. Check grants ------|
  |                          |<-- 7. Check approval ----|
  |                          |                          |
  |<-- 8. Action result -----|<-- 9. Audit log entry ---|
```

---

## Phase 5: Operations & Monitoring

### 5.1 Daily Workflow

**Morning:**
1. Check Overview dashboard — any pending approvals?
2. Review Activity Feed — overnight agent activity
3. Check Analytics — any anomalies in token usage?

**During the day:**
1. Approve/deny pending requests as they appear
2. Monitor agent health in Analytics
3. Review AI feedback for underperforming agents

**Weekly:**
1. Review Audit Log — verify chain integrity
2. Check Analytics trends — token usage, success rates
3. Review and rotate API keys if needed
4. Update grants based on agent usage patterns

### 5.2 Incident Response

**Agent behaving abnormally:**
1. Check agent's trust score in Analytics
2. Review recent audit entries for that agent
3. Check AI feedback for warnings
4. If compromised: Revoke agent immediately
5. Rotate keys for related agents
6. Review and tighten grants

**Approval backlog:**
1. Go to Approvals page
2. Sort by "waiting longest"
3. Batch approve safe actions (reads, non-destructive)
4. Review and decide on sensitive actions individually
5. Consider switching agent to autonomous mode if appropriate

### 5.3 Scaling

**Adding new agents:**
1. Create agent via dashboard or API
2. Set appropriate approval mode
3. Create grants with minimal required permissions
4. Monitor first 24h closely
5. Adjust grants based on actual usage

**Managing many agents:**
1. Use agent groups (Attributes page) to organize by team/purpose
2. Create org-wide policies for common rules
3. Use Analytics to identify top consumers
4. Set usage caps on grants to control costs
5. Review AI feedback regularly for optimization suggestions

---

## Feature Matrix

| Feature | Where to Find | What It Does | When to Use |
|---------|--------------|--------------|-------------|
| **Agent Identity** | Agents page | Cryptographic key pair per agent | Always — every agent needs one |
| **Grants** | Grants page | Resource+action permissions | Always — nothing allowed by default |
| **Approvals** | Approvals page | Human-in-the-loop decisions | When agent does sensitive actions |
| **Audit Log** | Activity page | Tamper-evident action history | Always — compliance + debugging |
| **Analytics** | Analytics page | Usage metrics + AI feedback | Daily monitoring |
| **Webhooks** | Webhooks page | Event notifications | When you need external integrations |
| **API Keys** | API Keys page | Dashboard/API authentication | When building custom integrations |
| **Trust Scoring** | Agent detail page | Behavioral trust assessment | Automatic — based on agent behavior |
| **Key Rotation** | Agent detail page | Safe key replacement | When key may be compromised |
| **Policy Engine** | Settings page | Automated response rules | At scale — when manual review is too slow |
| **AI Assistant** | Dashboard (chat) | Natural language queries | When investigating issues |
| **SDK Docs** | Docs page | Integration guides | During development |

---

## Environment Variables Reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection for nonces + caching |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ⬚ | For admin operations |
| `JWT_PRIVATE_KEY` | ⬚ | RSA private key (auto-generated if missing) |
| `JWT_PUBLIC_KEY` | ⬚ | RSA public key (auto-generated if missing) |
| `SENTRY_DSN` | ⬚ | Sentry error tracking |
| `KNOCK_API_KEY` | ⬚ | Knock notification service |
| `KNOCK_CHANNEL_ID` | ⬚ | Knock channel for notifications |
| `GOOGLE_API_KEY` | ⬚ | Google Gemini for AI assistant |
| `FINGERPRINT_API_KEY` | ⬚ | Fingerprint.com for device verification |
| `CORS_ORIGIN` | ⬚ | Allowed origins (default: `*`) |
| `TOKEN_TTL_MINUTES` | ⬚ | JWT expiry (default: 10) |
| `TOKEN_PRICE` | ⬚ | Cost per token for analytics (default: $0.0001) |
