import { useParams, Link } from "react-router-dom";
import { useDashboard } from "@/context/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Shield, Key, Activity, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function AgentDetailPage() {
  const { id } = useParams();
  const { agents, grants, auditLog, agentStats } = useDashboard();
  const agent = agents.find((a) => a.id === id);
  const agentGrants = grants.filter((g) => g.agentId === id);
  const agentActivity = auditLog.filter((e) => e.actor === agent?.name);
  const stats = agentStats.find((s) => s.id === id);

  if (!agent) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Agent not found</p>
        <Link to="/dashboard/agents"><Button variant="ghost" className="mt-4 text-slate-400"><ArrowLeft className="mr-2 h-4 w-4" /> Back to agents</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard/agents"><Button variant="ghost" size="icon" className="text-slate-400"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
            <Badge variant={agent.status === "active" ? "success" : agent.status === "revoked" ? "destructive" : "warning"}>{agent.status}</Badge>
            <Badge variant={agent.approvalMode === "autonomous" ? "info" : "secondary"}>{agent.approvalMode === "autonomous" ? "⚡ Autonomous" : "🛡️ HITL"}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">{agent.id}</p>
        </div>
      </div>

      {/* Trust Score */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${agent.trustScore >= 70 ? "bg-emerald-500/15" : agent.trustScore >= 40 ? "bg-amber-500/15" : "bg-red-500/15"}`}>
                <Shield className={`h-7 w-7 ${agent.trustScore >= 70 ? "text-emerald-400" : agent.trustScore >= 40 ? "text-amber-400" : "text-red-400"}`} />
              </div>
              <div>
                <p className="text-sm text-slate-400">Trust Score</p>
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-bold text-white">{agent.trustScore}</p>
                  <Badge variant={agent.trustLevel === "trusted" ? "success" : agent.trustLevel === "normal" ? "info" : agent.trustLevel === "questionable" ? "warning" : "destructive"}>
                    {agent.trustLevel}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="w-64">
              <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Untrusted</span><span>Trusted</span></div>
              <Progress value={agent.trustScore} className="h-3" />
            </div>
          </div>
          {stats && stats.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {stats.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> {w}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="grants">Grants ({agentGrants.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({agentActivity.length})</TabsTrigger>
          <TabsTrigger value="feedback">AI Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Tokens Issued", value: agent.tokensIssued.toLocaleString(), icon: Key, color: "text-blue-400" },
              { label: "Actions Total", value: agent.actionsTotal.toLocaleString(), icon: Activity, color: "text-cyan-400" },
              { label: "Allowed", value: agent.actionsAllowed.toLocaleString(), icon: CheckCircle2, color: "text-emerald-400" },
              { label: "Denied", value: agent.actionsDenied.toLocaleString(), icon: AlertTriangle, color: "text-red-400" },
            ].map((s) => (
              <Card key={s.label} className="border-slate-800 bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2"><s.icon className={`h-4 w-4 ${s.color}`} /><span className="text-xs text-slate-400">{s.label}</span></div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader><CardTitle className="text-base text-white">Identity</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-sm text-slate-400">Public Key</span><span className="font-mono text-xs text-slate-300">{agent.publicKey}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-400">Fingerprint</span><span className="font-mono text-xs text-slate-300">{agent.fingerprint}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-400">Created</span><span className="text-xs text-slate-300">{new Date(agent.createdAt).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-400">Last Active</span><span className="text-xs text-slate-300">{new Date(agent.lastActiveAt).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-400">Tier</span><Badge variant="secondary">{agent.tier}</Badge></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grants" className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800 text-left">
                  <th className="p-4 font-medium text-slate-400">Resource</th>
                  <th className="p-4 font-medium text-slate-400">Pattern</th>
                  <th className="p-4 font-medium text-slate-400">Actions</th>
                  <th className="p-4 font-medium text-slate-400">Status</th>
                  <th className="p-4 font-medium text-slate-400 text-right">Usage</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {agentGrants.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-800/30">
                      <td className="p-4 font-medium text-white">{g.resourceType}</td>
                      <td className="p-4 font-mono text-xs text-slate-300">{g.resourcePattern}</td>
                      <td className="p-4"><div className="flex gap-1">{g.actions.map((a) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}</div></td>
                      <td className="p-4"><Badge variant={g.status === "active" ? "success" : "destructive"}>{g.status}</Badge></td>
                      <td className="p-4 text-right text-slate-300">{g.usageCount.toLocaleString()}{g.usageCap ? ` / ${g.usageCap.toLocaleString()}` : ""}</td>
                    </tr>
                  ))}
                  {agentGrants.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No grants for this agent</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-800">
                {agentActivity.slice(0, 10).map((e) => (
                  <div key={e.id} className="flex items-center gap-4 p-4">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${e.result === "allowed" || e.result === "issued" ? "bg-emerald-500/10" : e.result === "denied" || e.result === "revoked" ? "bg-red-500/10" : "bg-amber-500/10"}`}>
                      {e.result === "allowed" || e.result === "issued" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{e.action} <span className="text-slate-400">{e.resourceType}/{e.resource}</span></p>
                      <p className="text-xs text-slate-500">{e.hash}</p>
                    </div>
                    <Badge variant={e.result === "allowed" || e.result === "issued" ? "success" : e.result === "denied" || e.result === "revoked" ? "destructive" : "warning"}>{e.result}</Badge>
                    <span className="text-xs text-slate-500">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
                {agentActivity.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No activity yet</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          {stats ? (
            <div className="space-y-4">
              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader><CardTitle className="text-base text-white">Performance Analysis</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">Health:</span>
                    <Badge variant={stats.health === "healthy" ? "success" : stats.health === "warning" ? "warning" : "destructive"} className="capitalize">{stats.health}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-slate-400">Success Rate</p><p className="text-xl font-bold text-white">{stats.successRate}%</p></div>
                    <div><p className="text-xs text-slate-400">Denial Rate</p><p className="text-xl font-bold text-white">{stats.denialRate}%</p></div>
                    <div><p className="text-xs text-slate-400">Avg Latency</p><p className="text-xl font-bold text-white">{stats.avgLatency}ms</p></div>
                    <div className="flex items-center gap-2"><p className="text-xs text-slate-400">Token Trend</p>
                      {stats.tokenTrend === "up" ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : stats.tokenTrend === "down" ? <TrendingDown className="h-4 w-4 text-red-400" /> : <Minus className="h-4 w-4 text-slate-400" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {stats.suggestions.length > 0 && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader><CardTitle className="text-base text-white">Suggestions</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {stats.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />{s}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="border-slate-800 bg-slate-900/50"><CardContent className="p-8 text-center text-slate-500">No stats available for this agent</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
