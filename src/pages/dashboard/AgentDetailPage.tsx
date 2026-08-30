import { useParams, Link } from "react-router-dom";
import { useDashboard } from "@/context/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Shield, Key, Activity, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import TrustGauge, { type TrustGaugeProps } from "@/components/TrustGauge";
import Sparkline from "@/components/Sparkline";

export default function AgentDetailPage() {
  const { id } = useParams();
  const { agents, grants, auditLog, agentStats } = useDashboard();
  const agent = agents.find((a) => a.id === id);
  const agentGrants = grants.filter((g) => g.agentId === id);
  const agentActivity = auditLog.filter((e) => e.actor === agent?.name);
  const stats = agentStats.find((s) => s.id === id);

  if (!agent) return <div className="text-center py-20"><p className="text-muted-foreground">Agent not found</p><Link to="/dashboard/agents"><Button variant="ghost" className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button></Link></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard/agents"><Button variant="ghost" size="icon" className="text-muted-foreground"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1"><div className="flex items-center gap-3"><h1 className="text-2xl font-serif">{agent.name}</h1><Badge variant={agent.status === "active" ? "success" : "destructive"}>{agent.status}</Badge><Badge variant={agent.approvalMode === "autonomous" ? "info" : "secondary"}>{agent.approvalMode === "autonomous" ? "Autonomous" : "HITL"}</Badge></div><p className="mt-1 text-sm text-muted-foreground font-mono">{agent.id}</p></div>
      </div>

      <Card className="border-hairline bg-surface/60 dark:bg-surface/40">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-6">
              <TrustGauge score={agent.trustScore} level={agent.trustLevel as TrustGaugeProps["level"]} size={100} />
              <div>
                <p className="text-sm font-medium">Trust Score</p>
                <p className="text-xs text-muted-foreground mt-1">Based on behavioral and contextual signals</p>
                {stats && stats.warnings.length > 0 && <div className="mt-3 space-y-1">{stats.warnings.map((w, i) => (<div key={i} className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3 w-3" /> {w}</div>))}</div>}
              </div>
            </div>
            <div className="w-48"><div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Untrusted</span><span>Trusted</span></div><Progress value={agent.trustScore} className="h-2" /></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted border border-hairline"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="grants">Grants ({agentGrants.length})</TabsTrigger><TabsTrigger value="activity">Activity ({agentActivity.length})</TabsTrigger><TabsTrigger value="feedback">AI Feedback</TabsTrigger></TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            {[{ l: "Tokens Issued", v: agent.tokensIssued.toLocaleString(), i: Key, c: "bg-muted" }, { l: "Actions Total", v: agent.actionsTotal.toLocaleString(), i: Activity, c: "bg-muted" }, { l: "Allowed", v: agent.actionsAllowed.toLocaleString(), i: CheckCircle2, c: "bg-green-500/15" }, { l: "Denied", v: agent.actionsDenied.toLocaleString(), i: AlertTriangle, c: "bg-red-500/15" }].map((s) => (
              <Card key={s.l} className="border-hairline bg-surface/60"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.c}`}><s.i className="h-4 w-4" /></div><span className="eyebrow">{s.l}</span></div><p className="text-2xl font-serif">{s.v}</p></CardContent></Card>
            ))}
          </div>
          <Card className="border-hairline bg-surface/60"><CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader><CardContent className="space-y-3">
            {[["Public Key", agent.publicKey], ["Fingerprint", agent.fingerprint], ["Created", new Date(agent.createdAt).toLocaleDateString()], ["Last Active", new Date(agent.lastActiveAt).toLocaleString()], ["Tier", agent.tier]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between"><span className="text-sm text-muted-foreground">{k as string}</span><span className="font-mono text-xs">{v as string}</span></div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="grants" className="space-y-4">
          <Card className="border-hairline bg-surface/60"><CardContent className="p-0">
            {agentGrants.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No grants for this agent</p> : (
              <table className="w-full text-sm"><thead><tr className="border-b border-hairline text-left"><th className="p-4 eyebrow">Resource</th><th className="p-4 eyebrow">Pattern</th><th className="p-4 eyebrow">Actions</th><th className="p-4 eyebrow">Status</th><th className="p-4 eyebrow text-right">Usage</th></tr></thead>
                <tbody className="divide-y divide-hairline/50">{agentGrants.map((g) => (<tr key={g.id} className="hover:bg-foreground/[0.02]"><td className="p-4 font-medium">{g.resourceType}</td><td className="p-4 font-mono text-xs text-muted-foreground">{g.resourcePattern}</td><td className="p-4"><div className="flex gap-1">{g.actions.map((a) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}</div></td><td className="p-4"><Badge variant={g.status === "active" ? "success" : "destructive"}>{g.status}</Badge></td><td className="p-4 text-right text-muted-foreground">{g.usageCount.toLocaleString()}</td></tr>))}</tbody></table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="border-hairline bg-surface/60"><CardContent className="p-0">
            <div className="divide-y divide-hairline/50">
              {agentActivity.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center gap-4 p-4 hover:bg-foreground/[0.02]">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${e.result === "allowed" || e.result === "issued" ? "bg-green-500/15" : "bg-red-500/15"}`}>{e.result === "allowed" || e.result === "issued" ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm">{e.action} <span className="text-muted-foreground">{e.resourceType}/{e.resource}</span></p><p className="text-xs text-muted-foreground font-mono">{e.hash}</p></div>
                  <Badge variant={e.result === "allowed" || e.result === "issued" ? "success" : "destructive"}>{e.result}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
              {agentActivity.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No activity yet</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          {stats ? (
            <div className="space-y-4">
              <Card className="border-hairline bg-surface/60"><CardHeader><CardTitle className="text-base">Performance Analysis</CardTitle></CardHeader><CardContent className="space-y-4">
                <div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">Health:</span><Badge variant={stats.health === "healthy" ? "success" : stats.health === "warning" ? "warning" : "destructive"} className="capitalize">{stats.health}</Badge></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="eyebrow">Success Rate</p><p className="text-xl font-serif">{stats.successRate}%</p></div>
                  <div><p className="eyebrow">Denial Rate</p><p className="text-xl font-serif">{stats.denialRate}%</p></div>
                  <div><p className="eyebrow">Avg Latency</p><p className="text-xl font-serif">{stats.avgLatency}ms</p></div>
                  <div className="flex items-center gap-2"><p className="eyebrow">Token Trend</p>{stats.tokenTrend === "up" ? <TrendingUp className="h-4 w-4 text-green-600" /> : stats.tokenTrend === "down" ? <TrendingDown className="h-4 w-4 text-red-600" /> : <Minus className="h-4 w-4 text-muted-foreground" />}</div>
                </div>
              </CardContent></Card>
              {stats.suggestions.length > 0 && <Card className="border-hairline bg-surface/60"><CardHeader><CardTitle className="text-base">Suggestions</CardTitle></CardHeader><CardContent><ul className="space-y-2">{stats.suggestions.map((s, i) => (<li key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />{s}</li>))}</ul></CardContent></Card>}
            </div>
          ) : <Card className="border-hairline bg-surface/60"><CardContent className="py-12 text-center text-muted-foreground">No stats available</CardContent></Card>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
