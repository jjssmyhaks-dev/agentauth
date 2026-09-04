import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { Alert, AlertRule, AgentHealth, AgentSession, AlertSeverity, AlertCategory } from "@/types";
import { mockAlerts, mockAlertRules, mockAgentHealth, mockAgentSessions } from "@/data/mock";

interface AlertContextType {
  alerts: Alert[];
  rules: AlertRule[];
  health: AgentHealth[];
  sessions: AgentSession[];
  activeAlerts: Alert[];
  criticalCount: number;
  warningCount: number;
  healthyAgents: number;
  totalAgents: number;
  activeSessions: number;
  toggleRule: (id: string) => void;
  acknowledgeAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  addAlert: (alert: Omit<Alert, "id" | "triggeredAt" | "status" | "acknowledgedAt" | "resolvedAt" | "acknowledgedBy">) => void;
  updateHealth: (agentId: string, updates: Partial<AgentHealth>) => void;
  addSession: (session: AgentSession) => void;
  updateSession: (id: string, updates: Partial<AgentSession>) => void;
  triggerRule: (ruleId: string, title: string, message: string, agentId?: string, agentName?: string) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

let alertIdCounter = 100;

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [rules, setRules] = useState<AlertRule[]>(mockAlertRules);
  const [health, setHealth] = useState<AgentHealth[]>(mockAgentHealth);
  const [sessions, setSessions] = useState<AgentSession[]>(mockAgentSessions);

  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === "active"), [alerts]);
  const criticalCount = useMemo(() => activeAlerts.filter((a) => a.severity === "critical").length, [activeAlerts]);
  const warningCount = useMemo(() => activeAlerts.filter((a) => a.severity === "warning").length, [activeAlerts]);
  const healthyAgents = useMemo(() => health.filter((h) => h.status === "healthy").length, [health]);
  const totalAgents = health.length;
  const activeSessions = useMemo(() => sessions.filter((s) => s.status === "active").length, [sessions]);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }, []);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "acknowledged" as const, acknowledgedAt: new Date().toISOString(), acknowledgedBy: "admin@acme.com" } : a
      )
    );
  }, []);

  const resolveAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "resolved" as const, resolvedAt: new Date().toISOString() } : a
      )
    );
  }, []);

  const addAlert = useCallback((alert: Omit<Alert, "id" | "triggeredAt" | "status" | "acknowledgedAt" | "resolvedAt" | "acknowledgedBy">) => {
    const newAlert: Alert = {
      ...alert,
      id: `alert_${++alertIdCounter}`,
      triggeredAt: new Date().toISOString(),
      status: "active",
      acknowledgedAt: null,
      resolvedAt: null,
      acknowledgedBy: null,
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 200));
  }, []);

  const updateHealth = useCallback((agentId: string, updates: Partial<AgentHealth>) => {
    setHealth((prev) => prev.map((h) => (h.agentId === agentId ? { ...h, ...updates } : h)));
  }, []);

  const addSession = useCallback((session: AgentSession) => {
    setSessions((prev) => [session, ...prev].slice(0, 100));
  }, []);

  const updateSession = useCallback((id: string, updates: Partial<AgentSession>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const triggerRule = useCallback(
    (ruleId: string, title: string, message: string, agentId?: string, agentName?: string) => {
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule || !rule.enabled) return;

      // Check cooldown
      if (rule.lastTriggeredAt) {
        const elapsed = Date.now() - new Date(rule.lastTriggeredAt).getTime();
        if (elapsed < rule.cooldownMs) return;
      }

      const newAlert: Alert = {
        id: `alert_${++alertIdCounter}`,
        ruleId,
        ruleName: rule.name,
        category: rule.category,
        severity: rule.severity,
        title,
        message,
        agentId,
        agentName,
        status: "active",
        triggeredAt: new Date().toISOString(),
        acknowledgedAt: null,
        resolvedAt: null,
        acknowledgedBy: null,
      };

      setAlerts((prev) => [newAlert, ...prev].slice(0, 200));
      setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, lastTriggeredAt: new Date().toISOString(), triggerCount: r.triggerCount + 1 } : r)));
    },
    [rules]
  );

  return (
    <AlertContext.Provider
      value={{
        alerts, rules, health, sessions,
        activeAlerts, criticalCount, warningCount,
        healthyAgents, totalAgents, activeSessions,
        toggleRule, acknowledgeAlert, resolveAlert, addAlert,
        updateHealth, addSession, updateSession, triggerRule,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertProvider");
  return ctx;
}
