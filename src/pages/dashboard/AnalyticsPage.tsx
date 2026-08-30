import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDashboard } from "@/context/DashboardContext";
import { generateTokenUsageData, generateAgentTokenData } from "@/data/mock";
import { TrendingUp, TrendingDown, Minus, Activity, Key, Shield, DollarSign, CheckCircle2, AlertTriangle, Zap } from "lucide-react";

const tokenUsage = generateTokenUsageData();
const agentTokens = generateAgentTokenData();
const maxToken = Math.max(...tokenUsage.map((d) => d.count));

export default function AnalyticsPage() {
  const { agents, agentStats, totalTokens } = useDashboard();
  const successRate = agents.length > 0 ? (agents.reduce((s, a) => s + a.actionsAllowed, 0) / agents.reduce((s, a) => s + a.actionsTotal, 0) * 100).toFixed(1) : "0";
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const estCost = (totalTokens * 0.0001).toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-slate-400">Token usage, agent performance, and AI feedback.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Tokens", value: totalTokens.toLocaleString(), icon: Key, color: "text-blue-400", bg: "bg-blue-500/15" },
          { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
          { label: "Active Agents", value: activeAgents, icon: Shield, color: "text-cyan-400", bg: "bg-cyan-500/15" },
          { label: "Est. Cost", value: `$${estCost}`, icon: DollarSign, color: "text-purple-400", bg: "bg-purple-500/15" },
        ].map((s) => (
          <Card key={s.label} className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold text-white">{s.value}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}><s.icon className={`h-4.5 w-4.5 ${s.color}`} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Token Usage Chart */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader><CardTitle className="text-base text-white">Token Usage Over Time (24h)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-48">
            {tokenUsage.slice(-48).map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center group" title={`${d.count} tokens at ${new Date(d.timestamp).toLocaleTimeString()}`}>
                <div
                  className="w-full rounded-t bg-blue-500/60 hover:bg-blue-400 transition-colors"
                  style={{ height: `${(d.count / maxToken) * 100}%`, minHeight: 2 }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>{new Date(tokenUsage[0]?.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span>{new Date(tokenUsage[tokenUsage.length - 1]?.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agent Performance */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader><CardTitle className="text-base text-white">Agent Performance</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {agentStats.map((s) => (
                <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-slate-800/20">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{s.name}</p>
                      <Badge variant={s.health === "healthy" ? "success" : s.health === "warning" ? "warning" : "destructive"} className="capitalize">{s.health}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
                      <span>{s.tokensIssued.toLocaleString()} tokens</span>
                      <span>{s.successRate}% success</span>
                    </div>
                  </div>
                  <div className="w-20">
                    <div className="h-2 w-full rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${s.health === "healthy" ? "bg-emerald-500" : s.health === "warning" ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${s.successRate}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Token Usage by Agent */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader><CardTitle className="text-base text-white">Token Usage by Agent</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {agentTokens.map((d, i) => {
              const maxAgentTokens = Math.max(...agentTokens.map((a) => a.count));
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{d.agent}</span>
                    <span className="text-slate-400">{d.count.toLocaleString()}</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${(d.count / maxAgentTokens) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* AI Feedback Panel */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader><CardTitle className="text-base text-white">AI Feedback & Suggestions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {agentStats.filter((s) => s.health !== "healthy").length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="text-sm text-emerald-400">All agents are healthy. No warnings or suggestions.</span>
            </div>
          ) : (
            agentStats.filter((s) => s.warnings.length > 0 || s.suggestions.length > 0).map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-medium text-white">{s.name}</h4>
                  <Badge variant={s.health === "healthy" ? "success" : s.health === "warning" ? "warning" : "destructive"} className="capitalize">{s.health}</Badge>
                </div>
                {s.warnings.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {s.warnings.map((w, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-amber-400"><AlertTriangle className="h-3 w-3" /> {w}</div>
                    ))}
                  </div>
                )}
                {s.suggestions.length > 0 && (
                  <div className="space-y-1.5">
                    {s.suggestions.map((sg, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-blue-400"><Zap className="h-3 w-3" /> {sg}</div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
