import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAlerts } from "@/context/AlertContext";
import {
  Search, Bell, BellOff, AlertTriangle, AlertCircle, Info,
  CheckCircle2, XCircle, Shield, Eye, Clock, Settings, Filter,
  ShieldAlert, Zap, Activity, Target,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Alert, AlertRule, AlertSeverity, AlertCategory } from "@/types";

const severityConfig: Record<AlertSeverity, { label: string; variant: "destructive" | "warning" | "default"; icon: React.ElementType; color: string }> = {
  critical: { label: "Critical", variant: "destructive", icon: XCircle, color: "text-red-600 dark:text-red-400" },
  warning: { label: "Warning", variant: "warning", icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400" },
  info: { label: "Info", variant: "default", icon: Info, color: "text-blue-600 dark:text-blue-400" },
};

const categoryConfig: Record<AlertCategory, { label: string; icon: React.ElementType; color: string }> = {
  health: { label: "Health", icon: Activity, color: "bg-green-500/15 text-green-600" },
  security: { label: "Security", icon: Shield, color: "bg-purple-500/15 text-purple-600" },
  permission: { label: "Permission", icon: Target, color: "bg-amber-500/15 text-amber-600" },
  performance: { label: "Performance", icon: Zap, color: "bg-blue-500/15 text-blue-600" },
  anomaly: { label: "Anomaly", icon: AlertCircle, color: "bg-pink-500/15 text-pink-600" },
};

function formatTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function AlertItem({ alert, onAcknowledge, onResolve }: { alert: Alert; onAcknowledge: (id: string) => void; onResolve: (id: string) => void }) {
  const sev = severityConfig[alert.severity];
  const cat = categoryConfig[alert.category];
  const SevIcon = sev.icon;
  const CatIcon = cat.icon;

  return (
    <motion.div layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }}>
      <div className={`flex items-start gap-3 rounded-xl border border-hairline bg-background/60 p-4 transition-colors hover:bg-surface/50 ${alert.status === "resolved" ? "opacity-60" : ""}`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sev.color === "text-red-600 dark:text-red-400" ? "bg-red-500/15" : sev.color === "text-amber-600 dark:text-amber-400" ? "bg-amber-500/15" : "bg-blue-500/15"}`}>
          <SevIcon className={`h-4 w-4 ${sev.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{alert.title}</p>
            <Badge variant={sev.variant} className="text-[10px]">{sev.label}</Badge>
            <Badge variant="outline" className="text-[10px] flex items-center gap-1"><CatIcon className="h-2.5 w-2.5" />{cat.label}</Badge>
            {alert.status === "acknowledged" && <Badge variant="outline" className="text-[10px]">ACK</Badge>}
            {alert.status === "resolved" && <Badge variant="success" className="text-[10px]">Resolved</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {formatTimeSince(alert.triggeredAt)}</span>
            {alert.agentName && <span className="flex items-center gap-1">Agent: {alert.agentName}</span>}
            <span>Rule: {alert.ruleName}</span>
          </div>
        </div>
        {alert.status === "active" && (
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => onAcknowledge(alert.id)}>
              <Eye className="mr-1 h-3 w-3" /> Ack
            </Button>
            <Button size="sm" className="h-7 rounded-full text-xs bg-green-600 text-white hover:bg-green-700" onClick={() => onResolve(alert.id)}>
              Resolve
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function RuleCard({ rule, onToggle }: { rule: AlertRule; onToggle: (id: string) => void }) {
  const cat = categoryConfig[rule.category];
  const sev = severityConfig[rule.severity];
  const CatIcon = cat.icon;

  return (
    <div className={`flex items-center gap-4 rounded-xl border border-hairline bg-background/60 p-4 transition-colors hover:bg-surface/50 ${!rule.enabled ? "opacity-50" : ""}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cat.color.split(" ")[0]}`}>
        <CatIcon className={`h-4 w-4 ${cat.color.split(" ")[1]}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{rule.name}</p>
          <Badge variant={sev.variant} className="text-[10px]">{sev.label}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{rule.description}</p>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>Condition: <code className="rounded bg-muted px-1 py-0.5">{rule.condition}</code></span>
          <span>Triggered: {rule.triggerCount}x</span>
          {rule.lastTriggeredAt && <span>Last: {formatTimeSince(rule.lastTriggeredAt)}</span>}
          <span>Cooldown: {rule.cooldownMs / 1000}s</span>
        </div>
        <div className="mt-1.5 flex gap-1">
          {rule.notifyChannels.map((ch) => (
            <Badge key={ch} variant="outline" className="text-[10px] capitalize">{ch}</Badge>
          ))}
        </div>
      </div>
      <button onClick={() => onToggle(rule.id)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${rule.enabled ? "bg-green-600" : "bg-muted"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.enabled ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export default function AlertsPage() {
  const { alerts, rules, activeAlerts, criticalCount, warningCount, acknowledgeAlert, resolveAlert, toggleRule } = useAlerts();
  const [tab, setTab] = useState<"alerts" | "rules">("alerts");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "acknowledged" | "resolved">("all");

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [alerts, severityFilter, statusFilter, search]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Alerts & Rules</h1>
          <p className="text-sm text-muted-foreground">Monitor agent behavior, configure alert rules, and review alert history.</p>
        </div>
      </motion.div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active Alerts", value: activeAlerts.length, icon: Bell, color: activeAlerts.length > 0 ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-muted text-foreground" },
          { label: "Critical", value: criticalCount, icon: XCircle, color: criticalCount > 0 ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-muted text-foreground" },
          { label: "Warnings", value: warningCount, icon: AlertTriangle, color: warningCount > 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-foreground" },
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

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-hairline bg-background p-1 w-fit">
        <button onClick={() => setTab("alerts")} className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${tab === "alerts" ? "bg-foreground/5 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
          Alert History
          {activeAlerts.length > 0 && <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">{activeAlerts.length}</span>}
        </button>
        <button onClick={() => setTab("rules")} className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${tab === "rules" ? "bg-foreground/5 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
          Alert Rules
          <span className="ml-1.5 text-[10px] text-muted-foreground">({rules.filter((r) => r.enabled).length} active)</span>
        </button>
      </div>

      {tab === "alerts" && (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search alerts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl border-hairline bg-background" />
            </div>
            <div className="flex gap-1.5">
              {(["all", "critical", "warning", "info"] as const).map((s) => (
                <Button key={s} size="sm" variant={severityFilter === s ? "default" : "outline"} onClick={() => setSeverityFilter(s)} className="rounded-full text-xs capitalize">
                  {s === "all" ? "All" : s}
                </Button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(["all", "active", "acknowledged", "resolved"] as const).map((s) => (
                <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="rounded-full text-xs capitalize">
                  {s}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredAlerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} onAcknowledge={acknowledgeAlert} onResolve={resolveAlert} />
              ))}
            </AnimatePresence>
            {filteredAlerts.length === 0 && (
              <Card className="border-hairline bg-surface/60 dark:bg-surface/40">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">No alerts match the current filter.</CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {tab === "rules" && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onToggle={toggleRule} />
          ))}
        </div>
      )}
    </div>
  );
}
