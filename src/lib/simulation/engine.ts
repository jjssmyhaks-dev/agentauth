import type {
  Agent,
  AgentHealth,
  AgentSession,
  Approval,
  AuditEntry,
  Notification,
} from "@/types";

/* ── Templates ───────────────────────────────────────────────────────── */

const activeAgentTemplates = [
  { id: "ag_01H8X9A1B2C3D4E5F6G7H8I9", name: "Code Review Bot", actions: ["read", "write"] as const, resources: ["acme-corp/api-gateway", "acme-corp/payment-service", "acme-corp/frontend"], resultWeights: [0.85, 0.15] },
  { id: "ag_01H8X9B2C3D4E5F6G7H8I9J0", name: "SDR Outreach Agent", actions: ["read", "write"] as const, resources: ["crm/contacts/active", "outbox/campaign-42", "email/draft"], resultWeights: [0.9, 0.1] },
  { id: "ag_01H8X9D4E5F6G7H8I9J0K1L2", name: "Customer Support Bot", actions: ["read", "write"] as const, resources: ["knowledge_base/faq", "tickets/TK-8901", "tickets/TK-8902"], resultWeights: [0.92, 0.08] },
  { id: "ag_01H8X9E5F6G7H8I9J0K1L2M3", name: "Data Pipeline Agent", actions: ["read", "write", "execute"] as const, resources: ["analytics/warehouse", "staging/logs", "etl/jobs/daily"], resultWeights: [0.8, 0.2] },
];

const approvalTemplates = [
  { action: "write" as const, resourceType: "repository", resource: "acme-corp/payment-service", context: "Auto-fix: deprecated dependency in package.json (CVE-2025-67890)" },
  { action: "execute" as const, resourceType: "ci_pipeline", resource: "acme-corp/api-gateway/deploy", context: "Trigger deployment: v2.15.0 → production (all tests passing)" },
  { action: "delete" as const, resourceType: "database", resource: "analytics/warehouse", context: "TRUNCATE staging_logs -- clearing staging table after successful ETL" },
  { action: "write" as const, resourceType: "email", resource: "outbox/follow-up", context: "Send follow-up batch: 50 emails to prospects who opened first outreach" },
  { action: "write" as const, resourceType: "repository", resource: "acme-corp/frontend", context: "Refactor: migrate auth component to new AgentAuth SDK v3" },
];

/* ── Events ──────────────────────────────────────────────────────────── */

export type SimEvent =
  | { type: "audit-entry"; entry: AuditEntry }
  | { type: "agent-stats"; agentId: string; tokensDelta: number; allowed: boolean }
  | { type: "approval-created"; approval: Approval }
  | { type: "notification"; payload: Omit<Notification, "id" | "read" | "createdAt"> }
  | { type: "health-updated"; agentId: string; patch: Partial<AgentHealth> }
  | { type: "alert-request"; ruleId: string; title: string; message: string; agentId?: string; agentName?: string }
  | { type: "session-updated"; id: string; patch: Partial<AgentSession> }
  | { type: "session-created"; session: AgentSession };

export interface SimState {
  agents: Agent[];
  health: AgentHealth[];
  sessions: AgentSession[];
}

export interface Simulator {
  /** Advance the simulation one tick. Pure with respect to `state` — all
   *  randomness and counters live inside the simulator instance, so tests can
   *  inject a seeded RNG and assert exact outcomes. */
  tick(state: SimState, now: number, tick: number): SimEvent[];
}

/* ── Engine ──────────────────────────────────────────────────────────── */

export function createSimulator(rng: () => number = Math.random): Simulator {
  const counters = { audit: 100, approval: 100, session: 100 };

  function pickRandom<T extends readonly unknown[]>(arr: T): T[number] {
    return arr[Math.floor(rng() * arr.length)] as T[number];
  }

  function weightedRandom(weights: number[]): number {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rng() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  function randomHash(): string {
    return "0x" + rng().toString(36).slice(2, 18).padStart(16, "0");
  }

  function tick(state: SimState, now: number, tickNumber: number): SimEvent[] {
    const events: SimEvent[] = [];
    const ts = new Date(now).toISOString();

    // 1) Generate a live audit entry
    const template = pickRandom(activeAgentTemplates);
    const action = pickRandom(template.actions) as string;
    const resource = pickRandom(template.resources) as string;
    const resultIdx = weightedRandom(template.resultWeights);
    const result = resultIdx === 0 ? "allowed" : "denied" as const;
    const id = `ae_live_${now}_${++counters.audit}`;

    events.push({
      type: "audit-entry",
      entry: {
        id,
        timestamp: ts,
        actor: template.name,
        actorType: "agent",
        action,
        resourceType: action === "read" ? "repository" : "ci_pipeline",
        resource,
        result,
        hash: randomHash(),
        previousHash: randomHash(),
      },
    });

    // 2) Increment agent token/action counters
    events.push({
      type: "agent-stats",
      agentId: template.id,
      tokensDelta: Math.floor(rng() * 3) + 1,
      allowed: result === "allowed",
    });

    // 3) Occasionally create a new pending approval (~30% chance)
    if (rng() < 0.3) {
      const activeHITL = state.agents.filter(
        (a) => a.approvalMode === "human-in-the-loop" && a.status === "active"
      );
      if (activeHITL.length > 0) {
        const agent = pickRandom(activeHITL);
        const tmpl = pickRandom(approvalTemplates);
        const approvalId = `ap_live_${now}_${++counters.approval}`;
        events.push({
          type: "approval-created",
          approval: {
            id: approvalId,
            agentId: agent.id,
            agentName: agent.name,
            action: tmpl.action,
            resourceType: tmpl.resourceType,
            resource: tmpl.resource,
            context: tmpl.context,
            status: "pending",
            requestedAt: ts,
            decidedAt: null,
            decidedBy: null,
            denialReason: null,
          },
        });
        events.push({
          type: "notification",
          payload: {
            type: "approval",
            priority: "high",
            title: `New approval needed: ${tmpl.action} on ${tmpl.resourceType}`,
            message: `${agent.name} requests ${tmpl.action} on ${tmpl.resource} — ${tmpl.context.slice(0, 80)}...`,
            agentId: agent.id,
            agentName: agent.name,
            actionUrl: "/dashboard/approvals",
          },
        });
      }
    }

    // 4) Health monitoring — update heartbeat for active agents every 2nd tick
    if (tickNumber % 2 === 0) {
      state.health.forEach((h) => {
        if (h.status === "offline") return; // Don't update offline agents

        const newResponse = Math.max(10, h.avgResponseMs + (rng() - 0.5) * 60);
        const newHistory = [...h.responseHistory.slice(1), newResponse];
        const newAvg = Math.round(newHistory.reduce((s, v) => s + v, 0) / newHistory.length);
        const sorted = [...newHistory].sort((a, b) => a - b);
        const newP95 = Math.round(sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1]);
        const newP99 = Math.round(sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1]);

        // Randomly simulate a missed heartbeat (~5% chance for degraded agents)
        const newMissed = h.status === "degraded" && rng() < 0.05
          ? h.missedHeartbeats + 1
          : h.status === "unhealthy"
            ? h.missedHeartbeats
            : Math.max(0, h.missedHeartbeats - 1);

        let newStatus = h.status;
        if (newMissed >= h.maxMissedHeartbeats) {
          newStatus = "unhealthy";
        } else if (newMissed > 0 || newAvg > 500) {
          newStatus = "degraded";
        } else if (h.status !== "healthy" && newMissed === 0 && newAvg < 400) {
          newStatus = "healthy";
        }

        events.push({
          type: "health-updated",
          agentId: h.agentId,
          patch: {
            lastHeartbeat: ts,
            missedHeartbeats: newMissed,
            responseHistory: newHistory,
            avgResponseMs: newAvg,
            p95ResponseMs: newP95,
            p99ResponseMs: newP99,
            totalHeartbeats: h.totalHeartbeats + 1,
            status: newStatus,
          },
        });

        // Trigger alert rules based on health
        if (newStatus === "unhealthy" && h.status !== "unhealthy") {
          events.push({
            type: "alert-request",
            ruleId: "rule_001",
            title: `${h.agentName} is unhealthy`,
            message: `Missed ${newMissed} heartbeats, response times elevated`,
            agentId: h.agentId,
            agentName: h.agentName,
          });
        }
        if (newP95 > 1000 && h.p95ResponseMs <= 1000) {
          events.push({
            type: "alert-request",
            ruleId: "rule_005",
            title: `${h.agentName}: slow responses`,
            message: `p95 response time reached ${newP95}ms`,
            agentId: h.agentId,
            agentName: h.agentName,
          });
        }
      });
    }

    // 5) Session tracking — update active session activity every 3rd tick
    if (tickNumber % 3 === 0) {
      state.sessions.forEach((s) => {
        if (s.status !== "active" && s.status !== "idle") return;

        // Check if session is idle (no activity for 30+ min)
        const idleTime = now - new Date(s.lastActivityAt).getTime();
        if (idleTime > 30 * 60 * 1000 && s.status === "active") {
          events.push({ type: "session-updated", id: s.id, patch: { status: "idle" } });
        }

        // Simulate activity on active sessions
        if (s.status === "active" && rng() < 0.4) {
          events.push({
            type: "session-updated",
            id: s.id,
            patch: {
              lastActivityAt: ts,
              tokensUsed: s.tokensUsed + Math.floor(rng() * 3) + 1,
              actionsPerformed: s.actionsPerformed + Math.floor(rng() * 2),
            },
          });
        }

        // Check session expiry (expiresAt is a hard cutoff, so idle must not
        // block it — the previous hook had `else` here and never expired sessions)
        if (new Date(s.expiresAt).getTime() < now && s.status === "active") {
          events.push({
            type: "session-updated",
            id: s.id,
            patch: {
              status: "expired",
              endedAt: ts,
              durationMs: now - new Date(s.startedAt).getTime(),
            },
          });
        }
      });
    }

    // 6) Occasionally create new sessions (~15% chance)
    if (rng() < 0.15) {
      const activeAgents = state.agents.filter((a) => a.status === "active");
      if (activeAgents.length > 0) {
        const agent = pickRandom(activeAgents);
        events.push({
          type: "session-created",
          session: {
            id: `sess_live_${now}_${++counters.session}`,
            agentId: agent.id,
            agentName: agent.name,
            status: "active",
            token: `tok_••••${rng().toString(36).slice(2, 6)}`,
            startedAt: ts,
            lastActivityAt: ts,
            expiresAt: new Date(now + 3600000).toISOString(),
            endedAt: null,
            durationMs: null,
            tokensUsed: 0,
            actionsPerformed: 0,
            ipAddress: `10.0.${Math.floor(rng() * 10)}.${Math.floor(rng() * 255)}`,
            userAgent: `AgentAuth-SDK/2.1 (${rng() > 0.5 ? "TypeScript" : "Python"})`,
            scopes: ["repository:read"],
            riskScore: Math.floor(rng() * 30),
          },
        });
      }
    }

    return events;
  }

  return { tick };
}
