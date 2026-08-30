import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDashboard } from "@/context/DashboardContext";
import { generateTokenUsageData, generateAgentTokenData } from "@/data/mock";
import { Key, Shield, DollarSign, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { motion } from "framer-motion";

const tokenUsage = generateTokenUsageData();
const agentTokens = generateAgentTokenData();
const maxToken = Math.max(...tokenUsage.map((d) => d.count));

function StatCard({ label, value, icon: Icon, color, index }: { label: string; value: string | number; icon: React.ElementType; color: string; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}>
      <Card className="border-hairline bg-surface/60 transition-shadow hover:shadow-lg hover:shadow-foreground/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div><p className="eyebrow">{label}</p><p className="mt-1 text-2xl font-serif">{value}</p></div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}><Icon className="h-4.5 w-4.5" /></div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function AnalyticsPage() {
  const { agents, agentStats, totalTokens } = useDashboard();
  const successRate = agents.length > 0 ? (agents.reduce((s, a) => s + a.actionsAllowed, 0) / agents.reduce((s, a) => s + a.actionsTotal, 0) * 100).toFixed(1) : "0";
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const estCost = (totalTokens * 0.0001).toFixed(2);

  const stats = [
    { l: "Total Tokens", v: totalTokens.toLocaleString(), i: Key, c: "bg-muted" },
    { l: "Success Rate", v: `${successRate}%`, i: CheckCircle2, c: "bg-green-500/15" },
    { l: "Active Agents", v: activeAgents, i: Shield, c: "bg-muted" },
    { l: "Est. Cost", v: `$${estCost}`, i: DollarSign, c: "bg-muted" },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-serif">Analytics</h1>
        <p className="text-sm text-muted-foreground">Token usage, agent performance, and AI feedback.</p>
      </motion.div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => <StatCard key={s.l} label={s.l} value={s.v} icon={s.i} color={s.c} index={i} />)}
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
        <Card className="border-hairline bg-surface/60">
          <CardHeader><CardTitle className="text-base">Token Usage Over Time (24h)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-48">{tokenUsage.slice(-48).map((d, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${(d.count / maxToken) * 100}%` }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.01, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 rounded-t bg-foreground hover:bg-foreground/80 transition-colors"
                style={{ minHeight: 2 }}
                title={`${d.count} tokens`}
              />
            ))}</div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground"><span>{new Date(tokenUsage[0]?.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span>{new Date(tokenUsage[tokenUsage.length - 1]?.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
          </CardContent>
        </Card>
      </motion.div>
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}>
          <Card className="border-hairline bg-surface/60">
            <CardHeader><CardTitle className="text-base">Agent Performance</CardTitle></CardHeader>
            <CardContent className="p-0"><div className="divide-y divide-hairline/50">{agentStats.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-foreground/[0.02] transition-colors">
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium truncate">{s.name}</p><Badge variant={s.health === "healthy" ? "success" : s.health === "warning" ? "warning" : "destructive"} className="capitalize">{s.health}</Badge></div><div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground"><span>{s.tokensIssued.toLocaleString()} tokens</span><span>{s.successRate}% success</span></div></div>
                <div className="w-20"><div className="h-2 w-full rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${s.successRate}%` }} transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }} className={`h-full rounded-full ${s.health === "healthy" ? "bg-green-500" : s.health === "warning" ? "bg-amber-500" : "bg-red-500"}`} /></div></div>
              </div>
            ))}</div></CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.45 }}>
          <Card className="border-hairline bg-surface/60">
            <CardHeader><CardTitle className="text-base">Token Usage by Agent</CardTitle></CardHeader>
            <CardContent className="space-y-4">{agentTokens.map((d, i) => { const mx = Math.max(...agentTokens.map((a) => a.count)); return (
              <div key={i}><div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">{d.agent}</span><span className="text-muted-foreground">{d.count.toLocaleString()}</span></div><div className="h-2.5 w-full rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${(d.count / mx) * 100}%` }} transition={{ duration: 0.6, delay: 0.5 + i * 0.08, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full bg-foreground" /></div></div>
            ); })}</CardContent>
          </Card>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 }}>
        <Card className="border-hairline bg-surface/60">
          <CardHeader><CardTitle className="text-base">AI Feedback & Suggestions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {agentStats.filter((s) => s.warnings.length > 0 || s.suggestions.length > 0).map((s) => (
              <div key={s.id} className="rounded-xl border border-hairline bg-background/60 p-4 transition-colors hover:bg-surface/50">
                <div className="flex items-center gap-2 mb-3"><h4 className="text-sm font-medium">{s.name}</h4><Badge variant={s.health === "healthy" ? "success" : s.health === "warning" ? "warning" : "destructive"} className="capitalize">{s.health}</Badge></div>
                {s.warnings.length > 0 && <div className="space-y-1.5 mb-3">{s.warnings.map((w, i) => (<div key={i} className="flex items-center gap-2 text-xs text-amber-700"><AlertTriangle className="h-3 w-3" /> {w}</div>))}</div>}
                {s.suggestions.length > 0 && <div className="space-y-1.5">{s.suggestions.map((sg, i) => (<div key={i} className="flex items-center gap-2 text-xs text-blue-700"><Zap className="h-3 w-3" /> {sg}</div>))}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
