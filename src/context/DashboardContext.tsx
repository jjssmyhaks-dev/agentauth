import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Agent, Grant, Approval, AuditEntry, ApiKey, Webhook, AgentStats } from "@/types";
import {
  mockAgents,
  mockGrants,
  mockApprovals,
  mockAuditLog,
  mockApiKeys,
  mockWebhooks,
  mockAgentStats,
} from "@/data/mock";

interface DashboardContextType {
  agents: Agent[];
  grants: Grant[];
  approvals: Approval[];
  auditLog: AuditEntry[];
  apiKeys: ApiKey[];
  webhooks: Webhook[];
  agentStats: AgentStats[];
  pendingApprovals: number;
  totalTokens: number;
  totalActions: number;
  addAgent: (agent: Agent) => void;
  addGrant: (grant: Grant) => void;
  approveRequest: (id: string) => void;
  denyRequest: (id: string, reason: string) => void;
  revokeAgent: (id: string) => void;
  revokeGrant: (id: string) => void;
  addApiKey: (key: ApiKey) => void;
  revokeApiKey: (id: string) => void;
  addWebhook: (wh: Webhook) => void;
  pauseWebhook: (id: string) => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [grants, setGrants] = useState<Grant[]>(mockGrants);
  const [approvals, setApprovals] = useState<Approval[]>(mockApprovals);
  const [auditLog] = useState<AuditEntry[]>(mockAuditLog);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(mockApiKeys);
  const [webhooks, setWebhooks] = useState<Webhook[]>(mockWebhooks);
  const [agentStats] = useState<AgentStats[]>(mockAgentStats);

  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const totalTokens = agents.reduce((s, a) => s + a.tokensIssued, 0);
  const totalActions = agents.reduce((s, a) => s + a.actionsTotal, 0);

  const addAgent = useCallback((agent: Agent) => {
    setAgents((prev) => [agent, ...prev]);
  }, []);

  const addGrant = useCallback((grant: Grant) => {
    setGrants((prev) => [grant, ...prev]);
  }, []);

  const approveRequest = useCallback((id: string) => {
    setApprovals((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "approved" as const, decidedAt: new Date().toISOString(), decidedBy: "admin@acme.com" }
          : a
      )
    );
  }, []);

  const denyRequest = useCallback((id: string, reason: string) => {
    setApprovals((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "denied" as const, decidedAt: new Date().toISOString(), decidedBy: "admin@acme.com", denialReason: reason }
          : a
      )
    );
  }, []);

  const revokeAgent = useCallback((id: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "revoked" as const } : a))
    );
  }, []);

  const revokeGrant = useCallback((id: string) => {
    setGrants((prev) =>
      prev.map((g) => (g.id === id ? { ...g, status: "revoked" as const } : g))
    );
  }, []);

  const addApiKey = useCallback((key: ApiKey) => {
    setApiKeys((prev) => [key, ...prev]);
  }, []);

  const revokeApiKey = useCallback((id: string) => {
    setApiKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: "revoked" as const } : k))
    );
  }, []);

  const addWebhook = useCallback((wh: Webhook) => {
    setWebhooks((prev) => [wh, ...prev]);
  }, []);

  const pauseWebhook = useCallback((id: string) => {
    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, status: w.status === "paused" ? ("active" as const) : ("paused" as const) }
          : w
      )
    );
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        agents, grants, approvals, auditLog, apiKeys, webhooks, agentStats,
        pendingApprovals, totalTokens, totalActions,
        addAgent, addGrant, approveRequest, denyRequest, revokeAgent, revokeGrant,
        addApiKey, revokeApiKey, addWebhook, pauseWebhook,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
