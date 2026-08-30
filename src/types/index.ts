export type AgentStatus = "active" | "revoked" | "rotating";
export type ApprovalMode = "autonomous" | "human-in-the-loop";
export type TrustLevel = "trusted" | "normal" | "questionable" | "untrusted";
export type Action = "read" | "write" | "delete" | "execute";
export type ApprovalStatus = "pending" | "approved" | "denied";
export type GrantStatus = "active" | "revoked" | "expired";

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  approvalMode: ApprovalMode;
  publicKey: string;
  fingerprint: string;
  trustLevel: TrustLevel;
  trustScore: number;
  createdAt: string;
  lastActiveAt: string;
  tokensIssued: number;
  actionsTotal: number;
  actionsAllowed: number;
  actionsDenied: number;
  tier: string;
  tags: string[];
}

export interface Grant {
  id: string;
  agentId: string;
  agentName: string;
  resourceType: string;
  resourcePattern: string;
  actions: Action[];
  status: GrantStatus;
  grantedAt: string;
  expiresAt: string | null;
  usageCount: number;
  usageCap: number | null;
  grantedBy: string;
}

export interface Approval {
  id: string;
  agentId: string;
  agentName: string;
  action: Action;
  resourceType: string;
  resource: string;
  context: string;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  denialReason: string | null;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorType: "agent" | "user" | "system";
  action: string;
  resourceType: string;
  resource: string;
  result: "allowed" | "denied" | "pending" | "issued" | "revoked" | "rotated";
  hash: string;
  previousHash: string;
  metadata?: Record<string, unknown>;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: "active" | "revoked";
}

export interface Webhook {
  id: string;
  url: string;
  eventTypes: string[];
  status: "active" | "paused" | "failed";
  lastDeliveryAt: string | null;
  secret: string;
  createdAt: string;
}

export interface TokenUsage {
  timestamp: string;
  count: number;
  agentId: string;
}

export interface AgentStats {
  id: string;
  name: string;
  health: "healthy" | "warning" | "critical";
  tokensIssued: number;
  actionsTotal: number;
  successRate: number;
  denialRate: number;
  avgLatency: number;
  tokenTrend: "up" | "down" | "stable";
  warnings: string[];
  suggestions: string[];
}

export interface Org {
  id: string;
  name: string;
  defaultApprovalMode: ApprovalMode;
  tokenTtlMinutes: number;
  ipAllowlist: string[];
  createdAt: string;
}
