import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
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
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  addGrant: (grant: Grant) => void;
  addApproval: (approval: Approval) => void;
  approveRequest: (id: string) => void;
  denyRequest: (id: string, reason: string) => void;
  revokeAgent: (id: string) => void;
  revokeAllAgents: () => void;
  revokeGrant: (id: string) => void;
  addApiKey: (key: ApiKey) => void;
  revokeApiKey: (id: string) => void;
  addWebhook: (wh: Webhook) => void;
  pauseWebhook: (id: string) => void;
  addAuditEntry: (entry: AuditEntry) => void;
  incrementAgentTokens: (agentId: string, delta?: number) => void;
  incrementAgentActions: (agentId: string, allowed: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [grants, setGrants] = useState<Grant[]>(mockGrants);
  const [approvals, setApprovals] = useState<Approval[]>(mockApprovals);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(mockAuditLog);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(mockApiKeys);
  const [webhooks, setWebhooks] = useState<Webhook[]>(mockWebhooks);
  const [agentStats] = useState<AgentStats[]>(mockAgentStats);

  const pendingApprovals = useMemo(() => approvals.filter((a) => a.status === "pending").length, [approvals]);
  const totalTokens = useMemo(() => agents.reduce((s, a) => s + a.tokensIssued, 0), [agents]);
  const totalActions = useMemo(() => agents.reduce((s, a) => s + a.actionsTotal, 0), [agents]);

  const addAgent = useCallback((agent: Agent) => {
    setAgents((prev) => [agent, ...prev]);
  }, []);

  const updateAgent = useCallback((id: string, updates: Partial<Agent>) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
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

  const revokeAllAgents = useCallback(() => {
    setAgents((prev) => prev.map((a) => ({ ...a, status: "revoked" as const })));
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

  const addAuditEntry = useCallback((entry: AuditEntry) => {
    setAuditLog((prev) => [entry, ...prev].slice(0, 200));
  }, []);

  const addApproval = useCallback((approval: Approval) => {
    setApprovals((prev) => [approval, ...prev]);
  }, []);

  const incrementAgentTokens = useCallback((agentId: string, delta = 1) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, tokensIssued: a.tokensIssued + delta, lastActiveAt: new Date().toISOString() } : a))
    );
  }, []);

  const incrementAgentActions = useCallback((agentId: string, allowed: boolean) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? {
        ...a,
        actionsTotal: a.actionsTotal + 1,
        actionsAllowed: a.actionsAllowed + (allowed ? 1 : 0),
        actionsDenied: a.actionsDenied + (allowed ? 0 : 1),
        lastActiveAt: new Date().toISOString(),
      } : a))
    );
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        agents, grants, approvals, auditLog, apiKeys, webhooks, agentStats,
        pendingApprovals, totalTokens, totalActions,
        addAgent, updateAgent, addGrant, addApproval, approveRequest, denyRequest, revokeAgent, revokeAllAgents, revokeGrant,
        addApiKey, revokeApiKey, addWebhook, pauseWebhook, addAuditEntry,
        incrementAgentTokens, incrementAgentActions,
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
