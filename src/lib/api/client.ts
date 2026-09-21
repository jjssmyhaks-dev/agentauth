/**
 * Thin HTTP client for the AgentAuth backend (see backend/src). Mappers
 * convert snake_case API payloads into the dashboard's camelCase types
 * (src/types/index.ts). Fields the API does not provide yet (trust score,
 * tags, tiers) are filled with sensible defaults rather than faked data.
 */
import type { Agent, Grant, Approval, AuditEntry, ApiKey, Action, Policy, PolicySimulationResult, AgentGroup, PolicyVersion, PolicyDryRunResult } from "@/types";
import { DEFAULT_ORG_ID } from "./config";

/** Fixed, valid-UUID actor for dashboard-initiated decisions. */
const DASHBOARD_USER_ID = "00000000-0000-4000-8000-000000000002";

class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Raw payloads roughly as the NestJS controllers return them. */
interface RawAgent {
  id: string;
  name: string;
  status?: string;
  org_id?: string;
  public_key?: string;
  key_fingerprint?: string;
  created_at?: string;
  last_active_at?: string | null;
  tokens_issued?: number;
  actions_total?: number;
  actions_allowed?: number;
  actions_denied?: number;
  default_approval_mode?: string;
}

interface RawGrant {
  id: string;
  agent_id: string;
  agent_name?: string;
  resource_type: string;
  resource_pattern: string;
  allowed_actions: string[];
  status?: string;
  created_at?: string;
  expires_at?: string | null;
  usage_count?: number;
  usage_cap?: number | null;
}

/** The approval API nests the agent object (innerJoinAndSelect). */
interface RawAgentRef {
  id?: string;
  name?: string;
}

interface RawApproval {
  id: string;
  agent_id: string;
  agent?: RawAgentRef;
  agent_name?: string;
  action: string;
  resource: string;
  resource_type?: string;
  context?: string;
  status: string;
  requested_at: string;
  decided_at?: string | null;
  decided_by?: string | null;
  denial_reason?: string | null;
}

interface RawAuditEntry {
  id: string;
  timestamp: string;
  actor_type?: string;
  actor_id?: string;
  action: string;
  resource: string;
  result: string;
  agent_name?: string;
}

interface RawApiKey {
  id: string;
  name: string;
  key?: string;
  prefix?: string;
  scopes?: string[];
  status?: string;
  created_at?: string;
  last_used_at?: string | null;
}

type Query = Record<string, string | number | undefined>;

// The dashboard types constrain actions/results to known unions; the API may
// return anything, so values are sanitized instead of blindly cast.
const VALID_ACTIONS = ["read", "write", "delete", "execute"] as const;

function sanitizeActions(raw: string[]): Action[] {
  const filtered = raw.filter((a): a is Action => (VALID_ACTIONS as readonly string[]).includes(a));
  return filtered.length > 0 ? filtered : ["read"];
}

function sanitizeAction(raw: string): Action {
  return (VALID_ACTIONS as readonly string[]).includes(raw) ? (raw as Action) : "read";
}

const AUDIT_RESULTS = ["allowed", "denied", "pending", "issued", "revoked", "rotated"] as const;

function sanitizeResult(raw: string): AuditEntry["result"] {
  return (AUDIT_RESULTS as readonly string[]).includes(raw) ? (raw as AuditEntry["result"]) : "allowed";
}

/** Some list endpoints return a bare array; others a paginated envelope or info object. */
function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  // Paginated envelope ({ data: [...], total, page, pages }) as returned by
  // GET /v1/audit.
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: T[] }).data;
  }
  return [];
}

function toQuery(params: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { query?: Query } = {},
): Promise<T> {
  const { query, ...rest } = init;
  const res = await fetch(`${baseUrl}/api${path}${toQuery(query ?? {})}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      "x-org-id": DEFAULT_ORG_ID,
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.message ?? body?.error ?? detail;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(
      typeof detail === "string" ? detail : JSON.stringify(detail),
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function mapAgent(raw: RawAgent): Agent {
  return {
    id: raw.id,
    name: raw.name,
    status: (raw.status as Agent["status"]) ?? "active",
    approvalMode: raw.default_approval_mode === "autonomous" ? "autonomous" : "human-in-the-loop",
    publicKey: raw.public_key ?? "",
    fingerprint: raw.key_fingerprint ?? "",
    trustLevel: "normal",
    trustScore: 75,
    createdAt: raw.created_at ?? new Date().toISOString(),
    lastActiveAt: raw.last_active_at ?? new Date().toISOString(),
    tokensIssued: raw.tokens_issued ?? 0,
    actionsTotal: raw.actions_total ?? 0,
    actionsAllowed: raw.actions_allowed ?? 0,
    actionsDenied: raw.actions_denied ?? 0,
    tier: "free",
    tags: [],
  };
}

function mapGrant(raw: RawGrant): Grant {
  return {
    id: raw.id,
    agentId: raw.agent_id,
    agentName: raw.agent_name ?? raw.agent_id,
    resourceType: raw.resource_type,
    resourcePattern: raw.resource_pattern,
    actions: sanitizeActions(raw.allowed_actions ?? []),
    status: (raw.status as Grant["status"]) ?? "active",
    grantedAt: raw.created_at ?? new Date().toISOString(),
    expiresAt: raw.expires_at ?? null,
    usageCount: raw.usage_count ?? 0,
    usageCap: raw.usage_cap ?? null,
    grantedBy: "api",
  };
}

function mapApproval(raw: RawApproval): Approval {
  return {
    id: raw.id,
    agentId: raw.agent?.id ?? raw.agent_id,
    agentName: raw.agent?.name ?? raw.agent_name ?? raw.agent_id,
    action: sanitizeAction(raw.action),
    resource: raw.resource,
    resourceType: raw.resource_type ?? "api",
    // The API stores context as jsonb (any JSON value) but the dashboard
    // renders it as text — stringify non-strings so an object payload can't
    // crash the approval cards ("Objects are not valid as a React child").
    context:
      raw.context == null
        ? ""
        : typeof raw.context === "string"
          ? raw.context
          : JSON.stringify(raw.context),
    status: raw.status as Approval["status"],
    requestedAt: raw.requested_at,
    decidedAt: raw.decided_at ?? null,
    decidedBy: raw.decided_by ?? null,
    denialReason: raw.denial_reason ?? null,
  };
}

function mapAuditEntry(raw: RawAuditEntry): AuditEntry {
  return {
    id: raw.id,
    timestamp: raw.timestamp,
    actorType: (raw.actor_type as AuditEntry["actorType"]) ?? "agent",
    actor: raw.agent_name ?? raw.actor_id ?? "system",
    action: raw.action,
    resourceType: "api",
    resource: raw.resource,
    result: sanitizeResult(raw.result),
    // The audit API returns hashes only on the hash-chain endpoints; entry
    // listing omits them, so they stay empty rather than being faked.
    hash: "",
    previousHash: "",
  };
}

function mapApiKey(raw: RawApiKey): ApiKey {
  return {
    id: raw.id,
    name: raw.name,
    prefix: raw.prefix ?? raw.key?.slice(0, 12) ?? raw.id.slice(0, 12),
    status: (raw.status as ApiKey["status"]) ?? "active",
    createdAt: raw.created_at ?? new Date().toISOString(),
    lastUsedAt: raw.last_used_at ?? null,
  };
}

interface RawGroup {
  id: string;
  org_id?: string;
  name: string;
  description?: string | null;
  member_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

interface RawPolicyVersion {
  id: string;
  policy_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  diff: Record<string, { from: unknown; to: unknown }>;
  change_type: string;
  changed_by?: string | null;
  created_at?: string;
}

interface RawDryRun {
  policy_id: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  would_change: boolean;
}

function mapGroup(raw: RawGroup): AgentGroup {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? null,
    memberIds: raw.member_ids ?? [],
    createdAt: raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? raw.created_at ?? new Date().toISOString(),
  };
}

const VERSION_CHANGE_TYPES = ["created", "updated", "enabled", "disabled", "deleted"] as const;

function mapPolicyVersion(raw: RawPolicyVersion): PolicyVersion {
  return {
    id: raw.id,
    policyId: raw.policy_id,
    version: raw.version,
    snapshot: raw.snapshot ?? {},
    diff: raw.diff ?? {},
    changeType: (VERSION_CHANGE_TYPES as readonly string[]).includes(raw.change_type)
      ? (raw.change_type as PolicyVersion["changeType"])
      : "updated",
    changedBy: raw.changed_by ?? null,
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

function mapDryRun(raw: RawDryRun): PolicyDryRunResult {
  return {
    policyId: raw.policy_id,
    changes: raw.changes ?? {},
    wouldChange: raw.would_change ?? false,
  };
}

interface RawPolicy {
  id: string;
  org_id: string;
  scope: string;
  scope_target_id?: string | null;
  trigger: string;
  condition: Record<string, unknown>;
  action: string;
  priority?: number;
  enabled?: boolean;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface RawSimulation {
  would_fire?: boolean;
  policies_checked?: number;
  result?: {
    matched?: boolean;
    policy_id?: string;
    action?: string;
    reason?: string;
  };
  evaluated_order?: Array<{
    policy_id?: string;
    action?: string;
    priority?: number;
    reason?: string;
  }>;
}

const POLICY_SCOPES = ["org", "agent", "agent_group"] as const;
const POLICY_ACTIONS = ["allow", "require_approval", "step_up", "deny"] as const;
const POLICY_TRIGGERS = [
  "permission_check",
  "new_environment",
  "trust_below_threshold",
  "session_mismatch",
  "off_hours",
  "resource_sensitivity_high",
] as const;

function mapPolicy(raw: RawPolicy): Policy {
  return {
    id: raw.id,
    orgId: raw.org_id,
    scope: (POLICY_SCOPES as readonly string[]).includes(raw.scope)
      ? (raw.scope as Policy["scope"])
      : "org",
    scopeTargetId: raw.scope_target_id ?? null,
    trigger: (POLICY_TRIGGERS as readonly string[]).includes(raw.trigger)
      ? (raw.trigger as Policy["trigger"])
      : "permission_check",
    condition: raw.condition ?? {},
    action: (POLICY_ACTIONS as readonly string[]).includes(raw.action)
      ? (raw.action as Policy["action"])
      : "require_approval",
    priority: raw.priority ?? 0,
    enabled: raw.enabled ?? true,
    description: raw.description ?? null,
    createdAt: raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? raw.created_at ?? new Date().toISOString(),
  };
}

function mapSimulation(raw: RawSimulation): PolicySimulationResult {
  return {
    wouldFire: raw.would_fire ?? false,
    policiesChecked: raw.policies_checked ?? 0,
    result: {
      matched: raw.result?.matched ?? false,
      policyId: raw.result?.policy_id,
      action: ((POLICY_ACTIONS as readonly string[]).includes(raw.result?.action ?? "")
        ? raw.result?.action
        : "allow") as PolicySimulationResult["result"]["action"],
      reason: raw.result?.reason,
    },
    evaluatedOrder: (raw.evaluated_order ?? []).map((m) => ({
      policyId: m.policy_id ?? "",
      action: ((POLICY_ACTIONS as readonly string[]).includes(m.action ?? "")
        ? m.action
        : "allow") as PolicySimulationResult["evaluatedOrder"][number]["action"],
      priority: m.priority ?? 0,
      reason: m.reason ?? "",
    })),
  };
}

/** REST client for the AgentAuth backend. All methods throw ApiError on failure. */
export function createApiClient(baseUrl: string) {
  const req = <T>(path: string, init?: RequestInit & { query?: Query }) =>
    request<T>(baseUrl, path, init);

  return {
    // The identity controller returns a bare array of agent entities.
    listAgents: () =>
      req<RawAgent[]>("/v1/agents", { query: { org_id: DEFAULT_ORG_ID } }).then((rows) =>
        (Array.isArray(rows) ? rows : [rows]).map(mapAgent),
      ),
    createAgent: (name: string, publicKey: string) =>
      req<{ agent_id: string }>("/v1/agents", {
        method: "POST",
        body: JSON.stringify({ org_id: DEFAULT_ORG_ID, name, public_key: publicKey }),
      }).then((r) => r.agent_id),
    revokeAgent: (id: string) =>
      req(`/v1/agents/${encodeURIComponent(id)}/revoke`, { method: "POST" }),

    listGrants: (agentId?: string) =>
      req<unknown>("/v1/grants", { query: { agent_id: agentId } }).then((rows) =>
        asArray<RawGrant>(rows).map(mapGrant),
      ),
    createGrant: (input: {
      agentId: string;
      resourceType: string;
      resourcePattern: string;
      actions: string[];
      expiresAt?: string | null;
      usageCap?: number | null;
    }) =>
      req<{ grant_id: string }>("/v1/grants", {
        method: "POST",
        body: JSON.stringify({
          agent_id: input.agentId,
          resource_type: input.resourceType,
          resource_pattern: input.resourcePattern,
          allowed_actions: input.actions,
          expires_at: input.expiresAt ?? undefined,
          usage_cap: input.usageCap ?? undefined,
        }),
      }).then((r) => r.grant_id),
    revokeGrant: (id: string) =>
      req(`/v1/grants/${encodeURIComponent(id)}`, { method: "DELETE" }),

    listApprovals: (status?: string) =>
      req<unknown>("/v1/approvals", { query: { org_id: DEFAULT_ORG_ID, status } }).then((rows) =>
        asArray<RawApproval>(rows).map(mapApproval),
      ),
    // The backend DTO wants decision: 'approve' | 'deny' and a UUID user id
    // (deciding with any other value silently maps to a denial).
    decideApproval: (id: string, decision: "approved" | "denied", reason?: string) =>
      req<{ approval_id: string }>(`/v1/approvals/${encodeURIComponent(id)}/decide`, {
        method: "POST",
        body: JSON.stringify({
          decision: decision === "denied" ? "deny" : "approve",
          decided_by_user_id: DASHBOARD_USER_ID,
          reason,
        }),
      }),

    listAudit: (limit = 100) =>
      req<unknown>("/v1/audit", { query: { org_id: DEFAULT_ORG_ID, limit } }).then((rows) =>
        asArray<RawAuditEntry>(rows).map(mapAuditEntry),
      ),
    verifyAuditChain: () =>
      req<{ valid: boolean }>("/v1/audit/verify-chain", { query: { org_id: DEFAULT_ORG_ID } }),

    // The list endpoint currently returns usage instructions (keys live in
    // Redis and are never re-listed) — surface that as an empty list.
    listApiKeys: () =>
      req<unknown>("/v1/api-keys", { headers: { "x-org-id": DEFAULT_ORG_ID } }).then((rows) =>
        asArray<RawApiKey>(rows).map(mapApiKey),
      ),
    createApiKey: (name: string) =>
      req<RawApiKey>("/v1/api-keys", {
        method: "POST",
        headers: { "x-org-id": DEFAULT_ORG_ID },
        body: JSON.stringify({ name, scopes: ["read"] }),
      }).then(mapApiKey),

    listGroups: () =>
      req<unknown>("/v1/groups", { query: { org_id: DEFAULT_ORG_ID } }).then((rows) =>
        asArray<RawGroup>(rows).map(mapGroup),
      ),
    createGroup: (name: string, description?: string, agentIds: string[] = []) =>
      req<{ group_id: string }>("/v1/groups", {
        method: "POST",
        body: JSON.stringify({ org_id: DEFAULT_ORG_ID, name, description }),
      })
        .then((r) =>
          agentIds.length > 0
            ? req(`/v1/groups/${encodeURIComponent(r.group_id)}/members?org_id=${DEFAULT_ORG_ID}`, {
                method: "PUT",
                body: JSON.stringify({ agent_ids: agentIds }),
              }).then(() => r.group_id)
            : r.group_id,
        ),
    deleteGroup: (id: string) =>
      req(`/v1/groups/${encodeURIComponent(id)}?org_id=${DEFAULT_ORG_ID}`, { method: "DELETE" }),

    listPolicyVersions: (policyId: string) =>
      req<unknown>(`/v1/policies/${encodeURIComponent(policyId)}/versions`, {
        query: { org_id: DEFAULT_ORG_ID },
      }).then((rows) => asArray<RawPolicyVersion>(rows).map(mapPolicyVersion)),
    dryRunPolicy: (id: string, updates: Partial<Pick<Policy, "action" | "priority" | "enabled" | "description">>) =>
      req<RawDryRun>(`/v1/policies/${encodeURIComponent(id)}/dry-run`, {
        method: "POST",
        body: JSON.stringify(updates),
      }).then(mapDryRun),

    listPolicies: () =>
      req<unknown>("/v1/policies", { query: { org_id: DEFAULT_ORG_ID } }).then((rows) =>
        asArray<RawPolicy>(rows).map(mapPolicy),
      ),
    createPolicy: (input: {
      scope: Policy["scope"];
      scopeTargetId?: string | null;
      trigger: Policy["trigger"];
      condition: Policy["condition"];
      action: Policy["action"];
      priority?: number;
      description?: string;
    }) =>
      req<{ policy_id: string }>("/v1/policies", {
        method: "POST",
        body: JSON.stringify({
          org_id: DEFAULT_ORG_ID,
          scope: input.scope,
          scope_target_id: input.scopeTargetId || undefined,
          trigger: input.trigger,
          condition: input.condition,
          action: input.action,
          priority: input.priority ?? 0,
          description: input.description || undefined,
        }),
      }).then((r) => r.policy_id),
    updatePolicy: (id: string, updates: Partial<Pick<Policy, "enabled" | "action" | "priority">>) =>
      req(`/v1/policies/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: updates.enabled,
          action: updates.action,
          priority: updates.priority,
        }),
      }),
    deletePolicy: (id: string) =>
      req(`/v1/policies/${encodeURIComponent(id)}`, { method: "DELETE" }),
    simulatePolicy: (input: {
      trigger: Policy["trigger"];
      agentId: string;
      currentTrustLevel?: string;
      sessionMismatch?: boolean;
      newEnvironment?: boolean;
      resourceSensitivity?: string;
      offHours?: boolean;
      resourceType?: string;
      resourceId?: string;
      action?: string;
    }) =>
      req<RawSimulation>("/v1/policies/simulate", {
        method: "POST",
        body: JSON.stringify({
          org_id: DEFAULT_ORG_ID,
          agent_id: input.agentId,
          trigger: input.trigger,
          current_trust_level: input.currentTrustLevel,
          session_mismatch: input.sessionMismatch,
          new_environment: input.newEnvironment,
          resource_sensitivity: input.resourceSensitivity,
          off_hours: input.offHours,
          resource_type: input.resourceType,
          resource_id: input.resourceId,
          action: input.action,
        }),
      }).then(mapSimulation),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export { ApiError };
