import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/context/DashboardContext";
import { Link } from "react-router-dom";
import { Shield, CheckSquare, Zap, Activity, ArrowRight, Clock, CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";

function StatCard({ icon: Icon, label, value, change, color }: { icon: React.ElementType; label: string; value: string | number; change?: string; color: string }) {
  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-1 text-3xl font-bold text-white">{value}</p>
            {change && <p className="mt-1 text-xs text-emerald-400">{change}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const { agents, pendingApprovals, totalTokens, totalActions, approvals, auditLog } = useDashboard();
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const todayActions = auditLog.filter((e) => e.result === "allowed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">Monitor your agents, approvals, and activity.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Shield} label="Active Agents" value={activeAgents} change={`${agents.length} total`} color="bg-blue-600/15" />
        <StatCard icon={CheckSquare} label="Pending Approvals" value={pendingApprovals} color={pendingApprovals > 0 ? "bg-amber-500/15" : "bg-emerald-500/15"} />
        <StatCard icon={Zap} label="Actions Today" value={todayActions.toLocaleString()} change="+12% from yesterday" color="bg-cyan-500/15" />
        <StatCard icon={Activity} label="Total Tokens" value={totalTokens.toLocaleString()} change="+8% this week" color="bg-purple-500/15" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Approvals */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base text-white">Pending Approvals</CardTitle>
            <Link to="/dashboard/approvals">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {approvals.filter((a) => a.status === "pending").length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No pending approvals</p>
            ) : (
              <div className="space-y-3">
                {approvals
                  .filter((a) => a.status === "pending")
                  .slice(0, 4)
                  .map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                        <Clock className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{a.agentName}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {a.action} {a.resourceType}/{a.resource}
                        </p>
                      </div>
                      <Badge variant="warning" className="shrink-0">Pending</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Activity Feed */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base text-white">Live Activity</CardTitle>
            <Link to="/dashboard/activity">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auditLog.slice(0, 6).map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-1">
                    {entry.result === "allowed" || entry.result === "issued" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : entry.result === "denied" || entry.result === "revoked" ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">
                      <span className="font-medium">{entry.actor}</span>
                      <span className="text-slate-400"> — {entry.action}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {entry.resourceType}/{entry.resource}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Health Summary */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base text-white">Agent Overview</CardTitle>
          <Link to="/dashboard/agents">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              Manage agents <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="pb-3 font-medium text-slate-400">Agent</th>
                  <th className="pb-3 font-medium text-slate-400">Status</th>
                  <th className="pb-3 font-medium text-slate-400">Approval</th>
                  <th className="pb-3 font-medium text-slate-400">Trust</th>
                  <th className="pb-3 font-medium text-slate-400 text-right">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-800/30">
                    <td className="py-3">
                      <Link to={`/dashboard/agents/${agent.id}`} className="font-medium text-white hover:text-blue-400">
                        {agent.name}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Badge variant={agent.status === "active" ? "success" : agent.status === "revoked" ? "destructive" : "warning"}>
                        {agent.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant={agent.approvalMode === "autonomous" ? "info" : "secondary"}>
                        {agent.approvalMode === "autonomous" ? "Autonomous" : "HITL"}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant={agent.trustLevel === "trusted" ? "success" : agent.trustLevel === "normal" ? "info" : agent.trustLevel === "questionable" ? "warning" : "destructive"}>
                        {agent.trustLevel} ({agent.trustScore})
                      </Badge>
                    </td>
                    <td className="py-3 text-right text-slate-300">{agent.tokensIssued.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
