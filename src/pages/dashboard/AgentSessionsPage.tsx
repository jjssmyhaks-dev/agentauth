import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAlerts } from "@/context/AlertContext";
import {
  Search, Monitor, Clock, Shield, AlertTriangle, Globe, Fingerprint,
  LogIn, LogOut, Timer, Ban, Wifi,
} from "lucide-react";
import { motion } from "framer-motion";
import DataTable, { type Column } from "@/components/DataTable";
import type { AgentSession, SessionStatus } from "@/types";

const statusConfig: Record<SessionStatus, { label: string; variant: "success" | "warning" | "destructive" | "default"; icon: React.ElementType }> = {
  active: { label: "Active", variant: "success", icon: Wifi },
  idle: { label: "Idle", variant: "warning", icon: Clock },
  expired: { label: "Expired", variant: "default", icon: Timer },
  revoked: { label: "Revoked", variant: "destructive", icon: Ban },
};

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function getRiskColor(score: number): string {
  if (score < 20) return "text-green-600 dark:text-green-400";
  if (score < 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getRiskBg(score: number): string {
  if (score < 20) return "bg-green-500/15";
  if (score < 50) return "bg-amber-500/15";
  return "bg-red-500/15";
}

export default function AgentSessionsPage() {
  const { sessions, activeSessions } = useAlerts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search && !s.agentName.toLowerCase().includes(search.toLowerCase()) && !s.ipAddress.includes(search)) return false;
      return true;
    });
  }, [sessions, statusFilter, search]);

  const stats = useMemo(() => {
    const totalTokens = sessions.reduce((s, sess) => s + sess.tokensUsed, 0);
    const totalActions = sessions.reduce((s, sess) => s + sess.actionsPerformed, 0);
    const avgRisk = sessions.length > 0 ? Math.round(sessions.reduce((s, sess) => s + sess.riskScore, 0) / sessions.length) : 0;
    const highRisk = sessions.filter((s) => s.riskScore >= 50).length;
    return { totalTokens, totalActions, avgRisk, highRisk };
  }, [sessions]);

  const columns: Column<AgentSession>[] = [
    {
      id: "agent", header: "Agent", sortable: true, getValue: (s) => s.agentName,
      render: (s) => (
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${getRiskBg(s.riskScore)}`}>
            <Monitor className={`h-3.5 w-3.5 ${getRiskColor(s.riskScore)}`} />
          </div>
          <div>
            <p className="text-sm font-medium">{s.agentName}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{s.token}</p>
          </div>
        </div>
      ),
    },
    {
      id: "status", header: "Status", sortable: true, getValue: (s) => s.status,
      render: (s) => {
        const cfg = statusConfig[s.status];
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      id: "startedAt", header: "Started", sortable: true, getValue: (s) => new Date(s.startedAt).getTime(),
      render: (s) => <span className="text-xs text-muted-foreground">{new Date(s.startedAt).toLocaleString()}</span>,
    },
    {
      id: "duration", header: "Duration",
      render: (s) => <span className="font-mono text-xs">{formatDuration(s.durationMs || (s.status === "active" ? Date.now() - new Date(s.startedAt).getTime() : 0))}</span>,
    },
    {
      id: "lastActivity", header: "Last Activity", sortable: true, getValue: (s) => new Date(s.lastActivityAt).getTime(),
      render: (s) => <span className="text-xs text-muted-foreground">{formatTimeSince(s.lastActivityAt)}</span>,
    },
    {
      id: "usage", header: "Usage",
      render: (s) => (
        <div className="text-xs text-muted-foreground">
          <span>{s.tokensUsed} tokens</span> · <span>{s.actionsPerformed} actions</span>
        </div>
      ),
    },
    {
      id: "risk", header: "Risk", sortable: true, getValue: (s) => s.riskScore,
      render: (s) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${s.riskScore < 20 ? "bg-green-500" : s.riskScore < 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, s.riskScore)}%` }} />
          </div>
          <span className={`font-mono text-xs ${getRiskColor(s.riskScore)}`}>{s.riskScore}</span>
        </div>
      ),
    },
    {
      id: "ip", header: "IP",
      render: (s) => <span className="font-mono text-xs text-muted-foreground">{s.ipAddress}</span>,
    },
  ];

  const selected = selectedSession ? sessions.find((s) => s.id === selectedSession) : null;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-serif">Agent Sessions</h1>
        <p className="text-sm text-muted-foreground">Track active sessions, token usage, and per-session risk scores.</p>
      </motion.div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Sessions", value: activeSessions, icon: Wifi, color: "bg-green-500/15 text-green-600 dark:text-green-400" },
          { label: "Total Sessions", value: sessions.length, icon: Monitor, color: "bg-muted text-foreground" },
          { label: "Total Tokens Used", value: stats.totalTokens.toLocaleString(), icon: Shield, color: "bg-muted text-foreground" },
          { label: "High Risk", value: stats.highRisk, icon: AlertTriangle, color: stats.highRisk > 0 ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-muted text-foreground" },
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
                    <s.icon className={`h-5 w-5 ${s.color.split(" ").slice(1).join(" ") || ""}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by agent name or IP..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl border-hairline bg-background" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 rounded-xl border-hairline bg-background"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="border-hairline bg-surface">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="border-hairline bg-surface/60 dark:bg-surface/40">
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={filtered}
              keyExtractor={(s) => s.id}
              pageSize={10}
              onRowClick={(s) => setSelectedSession(selectedSession === s.id ? null : s.id)}
              emptyMessage="No sessions match the current filter."
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Session detail panel */}
      {selected && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="border-hairline bg-surface/60 dark:bg-surface/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">Session Detail — {selected.agentName}</h3>
                <Button size="sm" variant="ghost" onClick={() => setSelectedSession(null)}>Close</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-hairline bg-background/60 p-3 space-y-1">
                  <p className="eyebrow">Session</p>
                  <p className="text-xs font-mono">{selected.id}</p>
                  <p className="text-xs font-mono">{selected.token}</p>
                </div>
                <div className="rounded-xl border border-hairline bg-background/60 p-3 space-y-1">
                  <p className="eyebrow">Connection</p>
                  <p className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> {selected.ipAddress}</p>
                  <p className="text-xs flex items-center gap-1"><Fingerprint className="h-3 w-3" /> {selected.userAgent}</p>
                </div>
                <div className="rounded-xl border border-hairline bg-background/60 p-3 space-y-1">
                  <p className="eyebrow">Scopes</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.scopes.map((scope) => (
                      <Badge key={scope} variant="outline" className="text-[10px]">{scope}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-hairline bg-background/60 p-3 space-y-1">
                  <p className="eyebrow">Risk Assessment</p>
                  <p className={`text-lg font-serif ${getRiskColor(selected.riskScore)}`}>{selected.riskScore}/100</p>
                  <p className="text-[10px] text-muted-foreground">
                    {selected.riskScore < 20 ? "Low risk — normal activity" : selected.riskScore < 50 ? "Medium risk — monitor closely" : "High risk — investigate immediately"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
