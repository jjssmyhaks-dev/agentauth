import { useEffect, useRef } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useNotifications } from "@/context/NotificationContext";

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

  // Use refs so the interval callback always reads latest values
  // without re-registering the interval on every state change
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

  useEffect(() => {
    const timer = setInterval(() => {
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
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]); // Only depends on interval — never re-registers
}
