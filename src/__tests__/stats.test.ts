import { describe, it, expect } from "vitest";
import { filterApprovals, computeSuccessRate } from "@/lib/stats";
import type { Approval, Agent } from "@/types";

function approval(id: string, status: Approval["status"]): Approval {
  return {
    id,
    agentId: "ag_1",
    agentName: "Test Agent",
    action: "read",
    resourceType: "database",
    resource: "customers",
    context: "test",
    status,
    requestedAt: "2025-08-30T00:00:00Z",
    decidedAt: null,
    decidedBy: null,
    denialReason: null,
  };
}

function agent(actionsTotal: number, actionsAllowed: number): Agent {
  return {
    id: "ag_1",
    name: "Test Agent",
    status: "active",
    approvalMode: "autonomous",
    publicKey: "pk",
    fingerprint: "fp",
    trustLevel: "normal",
    trustScore: 80,
    createdAt: "2025-07-01T00:00:00Z",
    lastActiveAt: "2025-08-30T00:00:00Z",
    tokensIssued: 10,
    actionsTotal,
    actionsAllowed,
    actionsDenied: actionsTotal - actionsAllowed,
    tier: "free",
    tags: [],
  };
}

describe("filterApprovals — tab/status mismatch regression (audit #5)", () => {
  const approvals = [
    approval("ap_1", "pending"),
    approval("ap_2", "pending"),
    approval("ap_3", "approved"),
    approval("ap_4", "denied"),
  ];

  it("returns only pending approvals for the pending tab", () => {
    expect(filterApprovals(approvals, "pending").map((a) => a.id)).toEqual(["ap_1", "ap_2"]);
  });

  it("returns only approved approvals for the approved tab", () => {
    expect(filterApprovals(approvals, "approved").map((a) => a.id)).toEqual(["ap_3"]);
  });

  it("returns only denied approvals for the denied tab", () => {
    expect(filterApprovals(approvals, "denied").map((a) => a.id)).toEqual(["ap_4"]);
  });

  it("returns everything for the all tab", () => {
    expect(filterApprovals(approvals, "all")).toHaveLength(4);
  });

  it("rejects tab ids that can never match a status", () => {
    expect(() => filterApprovals(approvals, "approve")).toThrow(/Unknown approvals tab/);
    expect(() => filterApprovals(approvals, "pending ")).toThrow(/Unknown approvals tab/);
  });
});

describe("computeSuccessRate — zero-division regression (audit #6)", () => {
  it("returns 0 instead of NaN% when agents exist but have zero actions", () => {
    expect(computeSuccessRate([agent(0, 0)])).toBe("0");
  });

  it("returns 0 for an empty agent list", () => {
    expect(computeSuccessRate([])).toBe("0");
  });

  it("computes the real rate when actions exist", () => {
    expect(computeSuccessRate([agent(1000, 870)])).toBe("87.0");
  });

  it("aggregates across multiple agents", () => {
    expect(computeSuccessRate([agent(1000, 900), agent(1000, 800)])).toBe("85.0");
  });

  it("never returns a NaN-prefixed string", () => {
    for (const total of [0, 0, 0]) {
      expect(computeSuccessRate([agent(total, 0)])).not.toContain("NaN");
    }
  });
});
