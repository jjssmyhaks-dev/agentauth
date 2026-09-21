import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
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
import { resolveDataSource } from "@/lib/dataSource";
import { ApiError, type ApiClient } from "@/lib/api/client";

interface DashboardContextType {
  /** Whether the dashboard is backed by the real API (false = mock/demo). */
  dataSource: "api" | "mock" | "resolving";
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
  /** Returns the agent id to use downstream (API id in API mode, local id in mock mode). */
  addAgent: (agent: Agent) => Promise<string>;
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
  const [dataSource, setDataSource] = useState<"api" | "mock" | "resolving">("resolving");

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

  // ── API-mode refetch (replaces the mock seed with real data) ─────────
  const refetchAll = useCallback(async (client: NonNullable<Awaited<ReturnType<typeof resolveDataSource>>["client"]>) => {
    const [fetchedAgents, fetchedGrants, fetchedApprovals, fetchedAudit, fetchedKeys] = await Promise.all([
      client.listAgents(),
      client.listGrants(),
      client.listApprovals(),
      client.listAudit(),
      client.listApiKeys(),
    ]);
    // Authoritative: an empty API list means an empty dashboard — showing
    // mock rows next to real API writes would be actively misleading.
    setAgents(fetchedAgents);
    setGrants(fetchedGrants);
    setApprovals(fetchedApprovals);
    setAuditLog(fetchedAudit);
    setApiKeys(fetchedKeys);
  }, []);

  useEffect(() => {
    let cancelled = false;
    resolveDataSource()
      .then(async ({ mode, client }) => {
        if (cancelled) return;
        setDataSource(mode);
        if (mode === "api" && client) await refetchAll(client);
      })
      .catch(() => {
        if (!cancelled) setDataSource("mock");
      });
    return () => {
      cancelled = true;
    };
  }, [refetchAll]);

  /** Run the mock mutation, then mirror it to the API (fire-and-forget). */
  const withApi = useCallback(
    (mockMutation: () => void, apiCall: (client: ApiClient) => Promise<unknown>) => {
      mockMutation();
      if (dataSource !== "api") return;
      void (async () => {
        const { client } = await resolveDataSource();
        if (!client) return;
        try {
          await apiCall(client);
        } catch (err) {
          if (err instanceof ApiError) {
            // eslint-disable-next-line no-console
            console.error(`[agentauth] API write failed (${err.status}): ${err.message}`);
          } else {
            // eslint-disable-next-line no-console
            console.error("[agentauth] API write failed:", err);
          }
        }
      })();
    },
    [dataSource, refetchAll],
  );

  const addAgent = useCallback(
    async (agent: Agent): Promise<string> => {
      setAgents((prev) => [agent, ...prev]);
      if (dataSource !== "api") return agent.id;
      const { client } = await resolveDataSource();
      if (!client) return agent.id;
      try {
        // The backend assigns the identity — downstream steps (grants) must
        // use it, not the locally generated placeholder id.
        const apiId = await client.createAgent(agent.name, agent.publicKey);
        await refetchAll(client);
        return apiId;
      } catch (err) {
        if (err instanceof ApiError) {
          // eslint-disable-next-line no-console
          console.error(`[agentauth] API write failed (${err.status}): ${err.message}`);
        } else {
          // eslint-disable-next-line no-console
          console.error("[agentauth] API write failed:", err);
        }
        return agent.id;
      }
    },
    [dataSource, refetchAll],
  );

  const updateAgent = useCallback(
    (id: string, updates: Partial<Agent>) => {
      withApi(
        () => setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a))),
        () => Promise.resolve(), // status/mode changes flow through dedicated endpoints later
      );
    },
    [withApi],
  );

  const addGrant = useCallback(
    (grant: Grant) => {
      withApi(
        () => setGrants((prev) => [grant, ...prev]),
        async (client) => {
          await client.createGrant({
            agentId: grant.agentId,
            resourceType: grant.resourceType,
            resourcePattern: grant.resourcePattern,
            actions: grant.actions as unknown as string[],
          });
          await refetchAll(client);
        },
      );
    },
    [withApi, refetchAll],
  );

  const approveRequest = useCallback(
    (id: string) => {
      withApi(
        () =>
          setApprovals((prev) =>
            prev.map((a) =>
              a.id === id
                ? { ...a, status: "approved" as const, decidedAt: new Date().toISOString(), decidedBy: "admin@acme.com" }
                : a
            ),
          ),
        async (client) => {
          await client.decideApproval(id, "approved");
          await refetchAll(client);
        },
      );
    },
    [withApi, refetchAll],
  );

  const denyRequest = useCallback(
    (id: string, reason: string) => {
      withApi(
        () =>
          setApprovals((prev) =>
            prev.map((a) =>
              a.id === id
                ? { ...a, status: "denied" as const, decidedAt: new Date().toISOString(), decidedBy: "admin@acme.com", denialReason: reason }
                : a
            ),
          ),
        async (client) => {
          await client.decideApproval(id, "denied", reason);
          await refetchAll(client);
        },
      );
    },
    [withApi, refetchAll],
  );

  const revokeAgent = useCallback(
    (id: string) => {
      withApi(
        () => setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status: "revoked" as const } : a))),
        async (client) => {
          await client.revokeAgent(id);
          await refetchAll(client);
        },
      );
    },
    [withApi, refetchAll],
  );

  const revokeAllAgents = useCallback(() => {
    setAgents((prev) => prev.map((a) => ({ ...a, status: "revoked" as const })));
  }, []);

  const revokeGrant = useCallback(
    (id: string) => {
      withApi(
        () => setGrants((prev) => prev.map((g) => (g.id === id ? { ...g, status: "revoked" as const } : g))),
        async (client) => {
          await client.revokeGrant(id);
          await refetchAll(client);
        },
      );
    },
    [withApi, refetchAll],
  );

  const addApiKey = useCallback(
    (key: ApiKey) => {
      withApi(
        () => setApiKeys((prev) => [key, ...prev]),
        async (client) => {
          await client.createApiKey(key.name);
          await refetchAll(client);
        },
      );
    },
    [withApi, refetchAll],
  );

  const revokeApiKey = useCallback((id: string) => {
    setApiKeys((prev) => prev.map((k) => (k.id === id ? { ...k, status: "revoked" as const } : k)));
  }, []);

  const addWebhook = useCallback((wh: Webhook) => {
    setWebhooks((prev) => [wh, ...prev]);
  }, []);

  const pauseWebhook = useCallback((id: string) => {
    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, status: w.status === "paused" ? ("active" as const) : ("paused" as const) } : w
      ),
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
      prev.map((a) => (a.id === agentId ? { ...a, tokensIssued: a.tokensIssued + delta, lastActiveAt: new Date().toISOString() } : a)),
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
      } : a)),
    );
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        dataSource,
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
