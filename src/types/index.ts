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
  sessionHistory?: SessionEntry[];
  keyRotationHistory?: KeyRotationEntry[];
}

export interface SessionEntry {
  id: string;
  startedAt: string;
  endedAt: string | null;
  tokensUsed: number;
  actionsPerformed: number;
  ipAddress: string;
  userAgent: string;
}

export interface KeyRotationEntry {
  id: string;
  rotatedAt: string;
  oldFingerprint: string;
  newFingerprint: string;
  reason: string;
  initiatedBy: string;
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

export type NotificationType = "approval" | "agent" | "grant" | "security" | "system";
export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  agentId?: string;
  agentName?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

// Agent Health & Heartbeat
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "offline";

export interface AgentHealth {
  agentId: string;
  agentName: string;
  status: HealthStatus;
  lastHeartbeat: string;
  heartbeatIntervalMs: number;
  missedHeartbeats: number;
  maxMissedHeartbeats: number;
  uptimePercent: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  p99ResponseMs: number;
  totalHeartbeats: number;
  failedHeartbeats: number;
  responseHistory: number[];
  statusChanges: StatusChange[];
}

export interface StatusChange {
  from: HealthStatus;
  to: HealthStatus;
  at: string;
  reason: string;
}

// Agent Sessions
export type SessionStatus = "active" | "expired" | "revoked" | "idle";

export interface AgentSession {
  id: string;
  agentId: string;
  agentName: string;
  status: SessionStatus;
  token: string;
  startedAt: string;
  lastActivityAt: string;
  expiresAt: string;
  endedAt: string | null;
  durationMs: number | null;
  tokensUsed: number;
  actionsPerformed: number;
  ipAddress: string;
  userAgent: string;
  scopes: string[];
  riskScore: number;
}

// Alerts
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertCategory = "health" | "security" | "permission" | "performance" | "anomaly";

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  category: AlertCategory;
  severity: AlertSeverity;
  enabled: boolean;
  condition: string;
  threshold: number;
  cooldownMs: number;
  lastTriggeredAt: string | null;
  triggerCount: number;
  notifyChannels: ("dashboard" | "email" | "webhook")[];
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  agentId?: string;
  agentName?: string;
  status: "active" | "acknowledged" | "resolved";
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  acknowledgedBy: string | null;
  metadata?: Record<string, unknown>;
}
