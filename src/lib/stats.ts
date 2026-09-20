import type { Agent, Approval } from "@/types";

/**
 * Aggregate success-rate math shared with AnalyticsPage.
 *
 * Regression guard (bug audit #6): the page previously divided by
 * `actionsTotal` without checking it — a dataset with zero total actions
 * produced `NaN%` on the Success Rate stat. Both call sites must guard the
 * denominator, not just the agent count.
 */
export function computeSuccessRate(agents: Agent[]): string {
  const total = agents.reduce((s, a) => s + a.actionsTotal, 0);
  if (agents.length === 0 || total === 0) return "0";
  return ((agents.reduce((s, a) => s + a.actionsAllowed, 0) / total) * 100).toFixed(1);
}

/**
 * Filter approvals for the Approvals page tabs.
 *
 * Regression guard (bug audit #5): the page's tab ids ("pending" /
 * "approved" / "denied" / "all") must map 1:1 onto ApprovalStatus values —
 * an earlier revision filtered against a tab value that never matched any
 * status, so the Pending tab rendered empty.
 */
export function filterApprovals(approvals: Approval[], tab: string): Approval[] {
  const VALID: Approval["status"][] = ["pending", "approved", "denied"];
  if (tab === "all") return approvals;
  if (!(VALID as string[]).includes(tab)) {
    throw new Error(`Unknown approvals tab: ${tab}`);
  }
  return approvals.filter((a) => a.status === tab);
}
