import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAlerts } from "@/context/AlertContext";
import {
  Heart, HeartPulse, Activity, Clock, Wifi, WifiOff, AlertTriangle,
  CheckCircle2, XCircle, Search, RefreshCw, TrendingUp, TrendingDown,
  ArrowRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Sparkline from "@/components/Sparkline";
import type { AgentHealth, HealthStatus } from "@/types";

const statusConfig: Record<HealthStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  healthy: { label: "Healthy", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/15", icon: CheckCircle2 },
  degraded: { label: "Degraded", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15", icon: AlertTriangle },
  unhealthy: { label: "Unhealthy", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/15", icon: XCircle },
  offline: { label: "Offline", color: "text-gray-500", bg: "bg-gray-500/15", icon: WifiOff },
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function HealthCard({ h, isExpanded, onToggle }: { h: AgentHealth; isExpanded: boolean; onToggle: () => void }) {
  const cfg = statusConfig[h.status];
  const Icon = cfg.icon;
  const heartbeatAge = Date.now() - new Date(h.lastHeartbeat).getTime();
  const isStale = heartbeatAge > h.heartbeatIntervalMs * 2;

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-hairline bg-surface/60 dark:bg-surface/40 transition-shadow hover:shadow-lg hover:shadow-foreground/5">
        <CardContent className="p-0">
          <button onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-foreground/[0.02]">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
              <Icon className={`h-5 w-5 ${cfg.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{h.agentName}</p>
                <Badge variant={h.status === "healthy" ? "success" : h.status === "degraded" ? "warning" : "destructive"} className="capitalize">{cfg.label}</Badge>
                {isStale && <Badge variant="destructive" className="text-[10px]">STALE</Badge>}
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTimeSince(h.lastHeartbeat)}</span>
                <span>{h.uptimePercent}% uptime</span>
                <span>{formatMs(h.avgResponseMs)} avg</span>
                <span>{h.missedHeartbeats}/{h.maxMissedHeartbeats} missed</span>
              </div>
            </div>
            <div className="w-24">
              <Sparkline data={h.responseHistory} width={96} height={32} className="opacity-70" />
            </div>
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="border-t border-hairline px-4 pb-4 pt-3">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-hairline bg-background/60 p-3">
                      <p className="eyebrow">Response Times</p>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Average</span><span className="font-mono">{formatMs(h.avgResponseMs)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">P95</span><span className="font-mono">{formatMs(h.p95ResponseMs)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">P99</span><span className="font-mono">{formatMs(h.p99ResponseMs)}</span></div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-hairline bg-background/60 p-3">
                      <p className="eyebrow">Heartbeat Stats</p>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total</span><span className="font-mono">{h.totalHeartbeats.toLocaleString()}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Failed</span><span className="font-mono text-red-500">{h.failedHeartbeats}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Interval</span><span className="font-mono">{h.heartbeatIntervalMs / 1000}s</span></div>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Last</span><span className="font-mono">{formatTimeSince(h.lastHeartbeat)}</span></div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-hairline bg-background/60 p-3">
                      <p className="eyebrow">Status History</p>
                      <div className="mt-2 space-y-2 max-h-28 overflow-y-auto">
                        {h.statusChanges.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No status changes recorded</p>
                        ) : (
                          h.statusChanges.map((sc, i) => (
                            <div key={i} className="text-xs">
                              <span className={statusConfig[sc.to].color}>{statusConfig[sc.from].label} → {statusConfig[sc.to].label}</span>
                              <span className="ml-1 text-muted-foreground">{formatTimeSince(sc.at)}</span>
                              <p className="text-muted-foreground mt-0.5">{sc.reason}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function AgentHealthPage() {
  const { health, healthyAgents, totalAgents } = useAlerts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HealthStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return health.filter((h) => {
      if (statusFilter !== "all" && h.status !== statusFilter) return false;
      if (search && !h.agentName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [health, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { healthy: 0, degraded: 0, unhealthy: 0, offline: 0 };
    health.forEach((h) => { counts[h.status]++; });
    return counts;
  }, [health]);

  const avgUptime = health.length > 0 ? (health.reduce((s, h) => s + h.uptimePercent, 0) / health.length).toFixed(1) : "0";
  const avgResponse = health.length > 0 ? Math.round(health.filter((h) => h.status !== "offline").reduce((s, h) => s + h.avgResponseMs, 0) / health.filter((h) => h.status !== "offline").length) : 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-serif">Agent Health</h1>
        <p className="text-sm text-muted-foreground">Heartbeat monitoring, uptime, and response time tracking.</p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Healthy", value: statusCounts.healthy, icon: CheckCircle2, color: "bg-green-500/15 text-green-600 dark:text-green-400" },
          { label: "Degraded", value: statusCounts.degraded, icon: AlertTriangle, color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
          { label: "Unhealthy", value: statusCounts.unhealthy, icon: XCircle, color: "bg-red-500/15 text-red-600 dark:text-red-400" },
          { label: "Offline", value: statusCounts.offline, icon: WifiOff, color: "bg-gray-500/15 text-gray-600" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}>
            <Card className="border-hairline bg-surface/60 dark:bg-surface/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">{s.label}</p>
                    <p className="mt-1 text-2xl font-serif">{s.value}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color.split(" ")[0]}`}>
                    <s.icon className={`h-5 w-5 ${s.color.split(" ").slice(1).join(" ")}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-hairline bg-surface/60 dark:bg-surface/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted"><HeartPulse className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Avg Uptime</p><p className="text-lg font-serif">{avgUptime}%</p></div>
          </CardContent>
        </Card>
        <Card className="border-hairline bg-surface/60 dark:bg-surface/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted"><Activity className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Avg Response</p><p className="text-lg font-serif">{formatMs(avgResponse)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-hairline bg-surface/60 dark:bg-surface/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted"><Wifi className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Online Agents</p><p className="text-lg font-serif">{healthyAgents}/{totalAgents}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl border-hairline bg-background" />
        </div>
        <div className="flex gap-1.5">
          {(["all", "healthy", "degraded", "unhealthy", "offline"] as const).map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="rounded-full text-xs capitalize">
              {s === "all" ? "All" : s}
              {s !== "all" && <span className="ml-1 text-[10px] opacity-70">({statusCounts[s]})</span>}
            </Button>
          ))}
        </div>
      </div>

      {/* Health cards */}
      <div className="space-y-3">
        {filtered.map((h) => (
          <HealthCard
            key={h.agentId}
            h={h}
            isExpanded={expandedId === h.agentId}
            onToggle={() => setExpandedId(expandedId === h.agentId ? null : h.agentId)}
          />
        ))}
        {filtered.length === 0 && (
          <Card className="border-hairline bg-surface/60 dark:bg-surface/40">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">No agents match the current filter.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
