import { useEffect, useRef } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useNotifications } from "@/context/NotificationContext";
import { useAlerts } from "@/context/AlertContext";

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

let auditCounter = 100;
let approvalCounter = 100;
let sessionCounter = 100;
let healthTick = 0;

function weightedRandom(weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function pickRandom<T extends readonly unknown[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)] as T[number];
}

export function useRealtime(intervalMs = 8000) {
  const { addAuditEntry, incrementAgentTokens, incrementAgentActions, addApproval, agents } = useDashboard();
  const { addNotification } = useNotifications();
  const { updateHealth, addSession, updateSession, triggerRule, health, sessions } = useAlerts();

  // Use refs so the interval callback always reads latest values
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  const addAuditEntryRef = useRef(addAuditEntry);
  addAuditEntryRef.current = addAuditEntry;

  const incrementAgentTokensRef = useRef(incrementAgentTokens);
  incrementAgentTokensRef.current = incrementAgentTokens;

  const incrementAgentActionsRef = useRef(incrementAgentActions);
  incrementAgentActionsRef.current = incrementAgentActions;

  const addApprovalRef = useRef(addApproval);
  addApprovalRef.current = addApproval;

  const addNotificationRef = useRef(addNotification);
  addNotificationRef.current = addNotification;

  const updateHealthRef = useRef(updateHealth);
  updateHealthRef.current = updateHealth;

  const addSessionRef = useRef(addSession);
  addSessionRef.current = addSession;

  const updateSessionRef = useRef(updateSession);
  updateSessionRef.current = updateSession;

  const triggerRuleRef = useRef(triggerRule);
  triggerRuleRef.current = triggerRule;

  const healthRef = useRef(health);
  healthRef.current = health;

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  useEffect(() => {
    const timer = setInterval(() => {
      healthTick++;

      // 1) Generate a live audit entry
      const template = pickRandom(activeAgentTemplates);
      const action = pickRandom(template.actions) as string;
      const resource = pickRandom(template.resources) as string;
      const resultIdx = weightedRandom(template.resultWeights);
      const result = resultIdx === 0 ? "allowed" : "denied" as const;
      const ts = new Date().toISOString();
      const id = `ae_live_${++auditCounter}`;
      const hash = "0x" + Math.random().toString(36).slice(2, 18).padStart(16, "0");

      addAuditEntryRef.current({
        id,
        timestamp: ts,
        actor: template.name,
        actorType: "agent",
        action,
        resourceType: action === "read" ? "repository" : "ci_pipeline",
        resource,
        result,
        hash,
        previousHash: "0x" + Math.random().toString(36).slice(2, 18).padStart(16, "0"),
      });

      // 2) Increment agent token/action counters
      incrementAgentTokensRef.current(template.id, Math.floor(Math.random() * 3) + 1);
      incrementAgentActionsRef.current(template.id, result === "allowed");

      // 3) Occasionally create a new pending approval (~30% chance)
      if (Math.random() < 0.3) {
        const currentAgents = agentsRef.current;
        const activeHITL = currentAgents.filter((a) => a.approvalMode === "human-in-the-loop" && a.status === "active");
        if (activeHITL.length > 0) {
          const agent = pickRandom(activeHITL);
          const tmpl = pickRandom(approvalTemplates);
          const approvalId = `ap_live_${++approvalCounter}`;
          addApprovalRef.current({
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
          });

          addNotificationRef.current({
            type: "approval",
            priority: "high",
            title: `New approval needed: ${tmpl.action} on ${tmpl.resourceType}`,
            message: `${agent.name} requests ${tmpl.action} on ${tmpl.resource} — ${tmpl.context.slice(0, 80)}...`,
            agentId: agent.id,
            agentName: agent.name,
            actionUrl: "/dashboard/approvals",
          });
        }
      }

      // 4) Health monitoring — update heartbeat for active agents every tick
      if (healthTick % 2 === 0) {
        const currentHealth = healthRef.current;
        currentHealth.forEach((h) => {
          if (h.status === "offline") return; // Don't update offline agents

          const newResponse = Math.max(10, h.avgResponseMs + (Math.random() - 0.5) * 60);
          const newHistory = [...h.responseHistory.slice(1), newResponse];
          const newAvg = Math.round(newHistory.reduce((s, v) => s + v, 0) / newHistory.length);
          const sorted = [...newHistory].sort((a, b) => a - b);
          const newP95 = Math.round(sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1]);
          const newP99 = Math.round(sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1]);

          // Randomly simulate a missed heartbeat (~5% chance for degraded agents)
          const newMissed = h.status === "degraded" && Math.random() < 0.05
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

          updateHealthRef.current(h.agentId, {
            lastHeartbeat: ts,
            missedHeartbeats: newMissed,
            responseHistory: newHistory,
            avgResponseMs: newAvg,
            p95ResponseMs: newP95,
            p99ResponseMs: newP99,
            totalHeartbeats: h.totalHeartbeats + 1,
            status: newStatus,
          });

          // Trigger alert rules based on health
          if (newStatus === "unhealthy" && h.status !== "unhealthy") {
            triggerRuleRef.current("rule_001", `${h.agentName} is unhealthy`, `Missed ${newMissed} heartbeats, response times elevated`, h.agentId, h.agentName);
          }
          if (newP95 > 1000 && h.p95ResponseMs <= 1000) {
            triggerRuleRef.current("rule_005", `${h.agentName}: slow responses`, `p95 response time reached ${newP95}ms`, h.agentId, h.agentName);
          }
        });
      }

      // 5) Session tracking — update active session activity
      if (healthTick % 3 === 0) {
        const currentSessions = sessionsRef.current;
        currentSessions.forEach((s) => {
          if (s.status !== "active" && s.status !== "idle") return;

          // Check if session is idle (no activity for 30+ min)
          const idleTime = Date.now() - new Date(s.lastActivityAt).getTime();
          if (idleTime > 30 * 60 * 1000 && s.status === "active") {
            updateSessionRef.current(s.id, { status: "idle" });
          }

          // Simulate activity on active sessions
          if (s.status === "active" && Math.random() < 0.4) {
            updateSessionRef.current(s.id, {
              lastActivityAt: ts,
              tokensUsed: s.tokensUsed + Math.floor(Math.random() * 3) + 1,
              actionsPerformed: s.actionsPerformed + Math.floor(Math.random() * 2),
            });
          }

          // Check session expiry
          if (new Date(s.expiresAt).getTime() < Date.now() && s.status === "active") {
            updateSessionRef.current(s.id, {
              status: "expired",
              endedAt: ts,
              durationMs: new Date(ts).getTime() - new Date(s.startedAt).getTime(),
            });
          }
        });
      }

      // 6) Occasionally create new sessions (~15% chance)
      if (Math.random() < 0.15) {
        const activeAgents = agentsRef.current.filter((a) => a.status === "active");
        if (activeAgents.length > 0) {
          const agent = pickRandom(activeAgents);
          const newSession = {
            id: `sess_live_${++sessionCounter}`,
            agentId: agent.id,
            agentName: agent.name,
            status: "active" as const,
            token: `tok_••••${Math.random().toString(36).slice(2, 6)}`,
            startedAt: ts,
            lastActivityAt: ts,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            endedAt: null,
            durationMs: null,
            tokensUsed: 0,
            actionsPerformed: 0,
            ipAddress: `10.0.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 255)}`,
            userAgent: `AgentAuth-SDK/2.1 (${Math.random() > 0.5 ? "TypeScript" : "Python"})`,
            scopes: ["repository:read"],
            riskScore: Math.floor(Math.random() * 30),
          };
          addSessionRef.current(newSession);
        }
      }

    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]); // Only depends on interval — never re-registers
}
