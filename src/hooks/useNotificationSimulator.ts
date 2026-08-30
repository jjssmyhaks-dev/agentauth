import { useEffect, useRef } from "react";
import { useNotifications } from "@/context/NotificationContext";
import type { NotificationType, NotificationPriority } from "@/types";

const simulatedEvents: Array<{
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  agentName: string;
  agentId: string;
  actionUrl?: string;
}> = [
  {
    type: "approval",
    priority: "urgent",
    title: "New approval: ALTER TABLE users",
    message: "Database Migration Agent requests execute on production/main",
    agentName: "Database Migration Agent",
    agentId: "ag_01H8X9C3D4E5F6G7H8I9J0K1",
    actionUrl: "/dashboard/approvals",
  },
  {
    type: "agent",
    priority: "medium",
    title: "Token issued: Code Review Bot",
    message: "Short-lived token (TTL 600s) issued for repository:read scope",
    agentName: "Code Review Bot",
    agentId: "ag_01H8X9A1B2C3D4E5F6G7H8I9",
    actionUrl: "/dashboard/agents",
  },
  {
    type: "security",
    priority: "high",
    title: "Unusual activity: SDR Outreach Agent",
    message: "Request volume 2.8× above normal baseline in the last 5 minutes",
    agentName: "SDR Outreach Agent",
    agentId: "ag_01H8X9B2C3D4E5F6G7H8I9J0",
    actionUrl: "/dashboard/agents/ag_01H8X9B2C3D4E5F6G7H8I9J0",
  },
  {
    type: "grant",
    priority: "medium",
    title: "Grant usage 80%: CI/CD Pipeline",
    message: "Code Review Bot grant gr_002 approaching usage cap (8,000/10,000)",
    agentName: "Code Review Bot",
    agentId: "ag_01H8X9A1B2C3D4E5F6G7H8I9",
    actionUrl: "/dashboard/grants",
  },
  {
    type: "approval",
    priority: "high",
    title: "Approval needed: write to analytics/warehouse",
    message: "Data Pipeline Agent requests bulk insert of 50,000 rows",
    agentName: "Data Pipeline Agent",
    agentId: "ag_01H8X9E5F6G7H8I9J0K1L2M3",
    actionUrl: "/dashboard/approvals",
  },
  {
    type: "system",
    priority: "low",
    title: "Health check: Customer Support Bot",
    message: "All systems nominal — 98.5% success rate, latency within bounds",
    agentName: "Customer Support Bot",
    agentId: "ag_01H8X9D4E5F6G7H8I9J0K1L2",
    actionUrl: "/dashboard/agents/ag_01H8X9D4E5F6G7H8I9J0K1L2",
  },
  {
    type: "security",
    priority: "urgent",
    title: "Key compromise suspicion: same key, two hosts",
    message: "Security Scanner key detected from 2 concurrent IP ranges",
    agentName: "Security Scanner",
    agentId: "ag_01H8X9F6G7H8I9J0K1L2M3N4",
    actionUrl: "/dashboard/agents/ag_01H8X9F6G7H8I9J0K1L2M3N4",
  },
  {
    type: "agent",
    priority: "low",
    title: "Key rotation complete: Data Pipeline Agent",
    message: "New Ed25519 key pair generated and registered successfully",
    agentName: "Data Pipeline Agent",
    agentId: "ag_01H8X9E5F6G7H8I9J0K1L2M3",
    actionUrl: "/dashboard/agents/ag_01H8X9E5F6G7H8I9J0K1L2M3",
  },
];

export function useNotificationSimulator(intervalMs = 15000) {
  const { addNotification } = useNotifications();
  const idx = useRef(0);

  useEffect(() => {
    // Emit one immediately after 3s
    const initial = setTimeout(() => {
      const evt = simulatedEvents[0];
      addNotification(evt);
      idx.current = 1;
    }, 3000);

    const interval = setInterval(() => {
      const evt = simulatedEvents[idx.current % simulatedEvents.length];
      addNotification(evt);
      idx.current++;
    }, intervalMs);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [addNotification, intervalMs]);
}
