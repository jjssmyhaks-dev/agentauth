import { describe, it, expect } from "vitest";
import { createSimulator, type SimState } from "@/lib/simulation/engine";
import type { Agent, AgentHealth, AgentSession } from "@/types";

// Deterministic RNG: deterministic input → deterministic simulation output.
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "ag_01H8X9A1B2C3D4E5F6G7H8I9",
    name: "Code Review Bot",
    status: "active",
    approvalMode: "human-in-the-loop",
    publicKey: "pk",
    fingerprint: "fp",
    trustLevel: "trusted",
    trustScore: 90,
    createdAt: "2025-07-01T00:00:00Z",
    lastActiveAt: "2025-08-30T00:00:00Z",
    tokensIssued: 0,
    actionsTotal: 0,
    actionsAllowed: 0,
    actionsDenied: 0,
    tier: "free",
    tags: [],
    ...overrides,
  };
}

function health(overrides: Partial<AgentHealth> = {}): AgentHealth {
  return {
    agentId: "ag_01H8X9A1B2C3D4E5F6G7H8I9",
    agentName: "Code Review Bot",
    status: "healthy",
    lastHeartbeat: "2025-08-30T04:00:00Z",
    heartbeatIntervalMs: 15000,
    missedHeartbeats: 0,
    maxMissedHeartbeats: 3,
    uptimePercent: 99,
    avgResponseMs: 100,
    p95ResponseMs: 200,
    p99ResponseMs: 300,
    totalHeartbeats: 10,
    failedHeartbeats: 0,
    responseHistory: [100, 100, 100],
    statusChanges: [],
    ...overrides,
  };
}

function session(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: "sess_1",
    agentId: "ag_01H8X9A1B2C3D4E5F6G7H8I9",
    agentName: "Code Review Bot",
    status: "active",
    token: "tok_x",
    startedAt: "2025-08-30T03:00:00Z",
    lastActivityAt: "2025-08-30T04:00:00Z",
    expiresAt: "2025-08-30T05:00:00Z",
    endedAt: null,
    durationMs: null,
    tokensUsed: 0,
    actionsPerformed: 0,
    ipAddress: "10.0.0.1",
    userAgent: "test",
    scopes: [],
    riskScore: 0,
    ...overrides,
  };
}

const NOW = Date.parse("2025-08-30T04:30:00Z");

function makeState(overrides: Partial<SimState> = {}): SimState {
  return {
    agents: [agent()],
    health: [health()],
    sessions: [session()],
    ...overrides,
  };
}

describe("simulation engine — determinism & correctness", () => {
  it("is deterministic under a seeded RNG", () => {
    const a = createSimulator(seededRng(42)).tick(makeState(), NOW, 1);
    const b = createSimulator(seededRng(42)).tick(makeState(), NOW, 1);
    expect(a).toEqual(b);
  });

  it("every tick emits exactly one audit entry with a timestamp-unique ID", () => {
    const sim = createSimulator(seededRng(7));
    const events = sim.tick(makeState(), NOW, 1);
    const audits = events.filter((e) => e.type === "audit-entry");
    expect(audits).toHaveLength(1);
    const entry = (audits[0] as { type: "audit-entry"; entry: { id: string } }).entry;
    expect(entry.id).toMatch(/^ae_live_/);
    expect(entry.id).toContain(String(NOW));
  });

  it("same-millisecond ticks still produce unique audit IDs (audit #8)", () => {
    const sim = createSimulator(seededRng(7));
    const ids = [1, 2, 3].map((tick) => {
      const events = sim.tick(makeState(), NOW, tick);
      const audit = events.find((e) => e.type === "audit-entry") as { type: "audit-entry"; entry: { id: string } };
      return audit.entry.id;
    });
    expect(new Set(ids).size).toBe(3);
  });

  it("always emits agent-stats with a positive token delta", () => {
    const events = createSimulator(seededRng(7)).tick(makeState(), NOW, 1);
    const stats = events.find((e) => e.type === "agent-stats");
    expect(stats).toBeDefined();
    if (stats?.type === "agent-stats") {
      expect(stats.tokensDelta).toBeGreaterThanOrEqual(1);
      expect(typeof stats.allowed).toBe("boolean");
    }
  });

  it("never updates offline agents' health", () => {
    const state = makeState({ health: [health({ status: "offline", agentName: "Offline Agent" })] });
    const events = createSimulator(seededRng(7)).tick(state, NOW, 2);
    expect(events.filter((e) => e.type === "health-updated")).toHaveLength(0);
    expect(events.filter((e) => e.type === "alert-request")).toHaveLength(0);
  });

  it("transitions to unhealthy and alerts once max missed heartbeats is reached", () => {
    const state = makeState({ health: [health({ status: "degraded", missedHeartbeats: 2, maxMissedHeartbeats: 3 })] });
    // Force the "missed heartbeat" branch: rng() < 0.05, degraded agent
    const events = createSimulator(() => 0.01).tick(state, NOW, 2);
    const update = events.find((e) => e.type === "health-updated");
    expect(update).toBeDefined();
    expect((update as { patch: { status: string; missedHeartbeats: number } }).patch.status).toBe("unhealthy");
    const alert = events.find((e) => e.type === "alert-request");
    expect(alert).toMatchObject({ type: "alert-request", ruleId: "rule_001" });
  });

  it("emits alert-request on the p95 threshold crossing only (not every tick above)", () => {
    const state = makeState({ health: [health({ status: "degraded", p95ResponseMs: 1100 })] });
    const events = createSimulator(seededRng(7)).tick(state, NOW, 2);
    const slow = events.filter((e) => e.type === "alert-request" && (e as { ruleId: string }).ruleId === "rule_005");
    // Already above 1000 before the tick → the h.p95 <= 1000 guard suppresses a duplicate
    expect(slow).toHaveLength(0);
  });

  it("expires an overdue active session even on an idle-check tick (hook fix)", () => {
    const state = makeState({
      sessions: [session({
        status: "active",
        lastActivityAt: new Date(NOW - 60 * 60 * 1000).toISOString(), // idle >30min
        expiresAt: new Date(NOW - 1000).toISOString(), // already overdue
        startedAt: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
      })],
    });
    const events = createSimulator(seededRng(7)).tick(state, NOW, 3);
    const patches = events.filter((e) => e.type === "session-updated") as Array<{ type: "session-updated"; id: string; patch: { status?: string } }>;
    const statuses = patches.map((p) => p.patch.status);
    expect(statuses).toContain("expired");
  });

  it("session expiry carries correct durationMs", () => {
    const startedAt = NOW - 90 * 60 * 1000;
    const state = makeState({
      sessions: [session({
        status: "active",
        lastActivityAt: new Date(NOW - 31 * 60 * 1000).toISOString(),
        expiresAt: new Date(NOW - 1000).toISOString(),
        startedAt: new Date(startedAt).toISOString(),
      })],
    });
    const events = createSimulator(seededRng(7)).tick(state, NOW, 3);
    const expiry = events.find(
      (e) => e.type === "session-updated" && (e as { patch: { status?: string } }).patch.status === "expired"
    ) as { patch: { durationMs: number } } | undefined;
    expect(expiry).toBeDefined();
    expect(expiry!.patch.durationMs).toBe(NOW - startedAt);
  });

  it("approval flow: HITL active agents can generate approval + notification pairs", () => {
    // Drive rng so the 30% approval branch fires (rng < 0.3) and picks deterministic templates
    const events = createSimulator(() => 0.1).tick(makeState(), NOW, 1);
    const approval = events.find((e) => e.type === "approval-created");
    const notification = events.find((e) => e.type === "notification");
    expect(approval).toBeDefined();
    expect(notification).toBeDefined();
    if (approval?.type === "approval-created") {
      expect(approval.approval.status).toBe("pending");
      expect(approval.approval.id).toMatch(/^ap_live_/);
    }
    if (notification?.type === "notification") {
      expect(notification.payload.actionUrl).toBe("/dashboard/approvals");
      expect(notification.payload.priority).toBe("high");
    }
  });

  it("skips approval generation when no HITL agents are active", () => {
    const state = makeState({ agents: [agent({ approvalMode: "autonomous" })] });
    const events = createSimulator(() => 0.1).tick(state, NOW, 1);
    expect(events.filter((e) => e.type === "approval-created")).toHaveLength(0);
    expect(events.filter((e) => e.type === "notification")).toHaveLength(0);
  });
});
