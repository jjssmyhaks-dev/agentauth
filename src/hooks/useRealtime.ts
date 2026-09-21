import { useEffect, useRef } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useNotifications } from "@/context/NotificationContext";
import { useAlerts } from "@/context/AlertContext";
import { createSimulator, type SimEvent, type SimState } from "@/lib/simulation/engine";

export function useRealtime(intervalMs = 8000) {
  const {
    addAuditEntry, incrementAgentTokens, incrementAgentActions,
    addApproval, agents,
  } = useDashboard();
  const { addNotification } = useNotifications();
  const {
    updateHealth, addSession, updateSession, triggerRule, health, sessions,
  } = useAlerts();

  // The tick callback runs on a stable interval, so it reads the latest state
  // through refs (registered once, never re-created — see useEffect below).
  const refs = {
    agents: useRef(agents),
    health: useRef(health),
    sessions: useRef(sessions),
    addAuditEntry: useRef(addAuditEntry),
    incrementAgentTokens: useRef(incrementAgentTokens),
    incrementAgentActions: useRef(incrementAgentActions),
    addApproval: useRef(addApproval),
    addNotification: useRef(addNotification),
    updateHealth: useRef(updateHealth),
    addSession: useRef(addSession),
    updateSession: useRef(updateSession),
    triggerRule: useRef(triggerRule),
  };
  refs.agents.current = agents;
  refs.health.current = health;
  refs.sessions.current = sessions;
  refs.addAuditEntry.current = addAuditEntry;
  refs.incrementAgentTokens.current = incrementAgentTokens;
  refs.incrementAgentActions.current = incrementAgentActions;
  refs.addApproval.current = addApproval;
  refs.addNotification.current = addNotification;
  refs.updateHealth.current = updateHealth;
  refs.addSession.current = addSession;
  refs.updateSession.current = updateSession;
  refs.triggerRule.current = triggerRule;

  useEffect(() => {
    // intervalMs <= 0 disables the simulator (e.g. when the dashboard runs
    // against the real API instead of mock data).
    if (intervalMs <= 0) return undefined;
    const simulator = createSimulator();

    const apply = (event: SimEvent) => {
      switch (event.type) {
        case "audit-entry":
          refs.addAuditEntry.current(event.entry);
          break;
        case "agent-stats":
          refs.incrementAgentTokens.current(event.agentId, event.tokensDelta);
          refs.incrementAgentActions.current(event.agentId, event.allowed);
          break;
        case "approval-created":
          refs.addApproval.current(event.approval);
          break;
        case "notification":
          refs.addNotification.current(event.payload);
          break;
        case "health-updated":
          refs.updateHealth.current(event.agentId, event.patch);
          break;
        case "alert-request":
          refs.triggerRule.current(event.ruleId, event.title, event.message, event.agentId, event.agentName);
          break;
        case "session-updated":
          refs.updateSession.current(event.id, event.patch);
          break;
        case "session-created":
          refs.addSession.current(event.session);
          break;
      }
    };

    let tickNumber = 0;

    const timer = setInterval(() => {
      const state: SimState = {
        agents: refs.agents.current,
        health: refs.health.current,
        sessions: refs.sessions.current,
      };
      // Module-level counter in the old hook: shared across instances and
      // remounts. tickNumber is now owned by this effect's closure.
      tickNumber++;
      const events = simulator.tick(state, Date.now(), tickNumber);
      events.forEach(apply);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);
}
