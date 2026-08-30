import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/context/DashboardContext";
import { useNotifications } from "@/context/NotificationContext";
import { Link } from "react-router-dom";
import { Shield, CheckSquare, Zap, Activity, ArrowRight, Clock } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sparkline from "@/components/Sparkline";
import GettingStarted from "@/components/GettingStarted";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function StatCard({ icon: Icon, label, value, color, sparkData, index }: { icon: React.ElementType; label: string; value: string | number; color: string; sparkData?: number[]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="border-hairline bg-surface/60 dark:bg-surface/40 transition-shadow hover:shadow-lg hover:shadow-foreground/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">{label}</p>
              <p className="mt-1 text-2xl font-serif">{value}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></div>
              {sparkData && <Sparkline data={sparkData} width={64} height={24} className="opacity-60" />}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* Live activity feed */
const feedData = [
  { agent: "Code Review Bot", action: "read", resource: "acme-corp/api-gateway", result: "allowed" as const },
  { agent: "SDR Outreach Agent", action: "write", resource: "crm/contacts/active", result: "allowed" as const },
  { agent: "Database Migration Agent", action: "delete", resource: "production/main", result: "pending" as const },
  { agent: "Customer Support Bot", action: "read", resource: "knowledge_base/faq", result: "allowed" as const },
];

function LiveFeed() {
  const [items, setItems] = useState(feedData.slice(0, 3));
  const idx = useRef(3);
  useEffect(() => {
    const i = setInterval(() => {
      setItems((prev) => [feedData[idx.current % feedData.length], ...prev].slice(0, 4));
      idx.current++;
    }, 4000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <motion.div
            key={`${item.agent}-${i}-${idx.current}`}
            layout
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1 - i * 0.12, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 rounded-xl border border-hairline bg-background/60 px-4 py-3 text-sm"
          >
            <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${item.result === "allowed" ? "bg-green-500" : item.result === "pending" ? "bg-amber-500" : "bg-red-500"}`} />
            <span className="truncate"><span className="font-medium">{item.agent}</span> <span className="text-muted-foreground">{item.action}</span> <span className="text-muted-foreground font-mono text-xs">{item.resource}</span></span>
            <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${item.result === "allowed" ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>{item.result}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function OverviewPage() {
  const { agents, pendingApprovals, totalTokens, approvals, auditLog, approveRequest, denyRequest } = useDashboard();
  const { addNotification, pushToast } = useNotifications();
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const todayActions = auditLog.filter((e) => e.result === "allowed").length;
  const auditEventsToday = auditLog.length;

  // Mock sparkline data (simulating 7-day trends)
  const agentSpark = [3, 4, 4, 5, 5, activeAgents, activeAgents];
  const approvalSpark = [2, 3, 1, 4, 2, pendingApprovals, pendingApprovals];
  const actionSpark = [120, 180, 95, 210, 175, todayActions, todayActions];
  const auditSpark = [45, 62, 38, 71, 55, auditEventsToday, auditEventsToday];

  const handleApprove = useCallback((id: string) => {
    const a = approvals.find((x) => x.id === id);
    approveRequest(id);
    if (a) {
      addNotification({ type: "approval", priority: "medium", title: `Approved: ${a.action} on ${a.resourceType}`, message: `${a.agentName} request for ${a.resource} approved`, agentId: a.agentId, agentName: a.agentName, actionUrl: "/dashboard/approvals" });
      pushToast({ type: "approval", priority: "medium", title: "Request approved", message: `${a.agentName} — ${a.action} ${a.resource}` });
    }
  }, [approvals, approveRequest, addNotification, pushToast]);

  const handleDeny = useCallback((id: string) => {
    const a = approvals.find((x) => x.id === id);
    denyRequest(id, "Denied from overview");
    if (a) {
      addNotification({ type: "approval", priority: "medium", title: `Denied: ${a.action} on ${a.resourceType}`, message: `${a.agentName} request for ${a.resource} denied`, agentId: a.agentId, agentName: a.agentName, actionUrl: "/dashboard/approvals" });
    }
  }, [approvals, denyRequest, addNotification]);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn} transition={{ duration: 0.4 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Overview</h1>
          <p className="text-sm text-muted-foreground">Monitor your agents, approvals, and activity.</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono text-muted-foreground">{currentTime.toLocaleTimeString()}</p>
          <p className="text-xs text-muted-foreground">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </motion.div>

      <GettingStarted />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Shield} label="Active Agents" value={activeAgents} color="bg-muted" sparkData={agentSpark} index={0} />
        <StatCard icon={CheckSquare} label="Pending Approvals" value={pendingApprovals} color={pendingApprovals > 0 ? "bg-amber-500/15" : "bg-green-500/15"} sparkData={approvalSpark} index={1} />
        <StatCard icon={Zap} label="Actions Today" value={todayActions.toLocaleString()} color="bg-muted" sparkData={actionSpark} index={2} />
        <StatCard icon={Activity} label="Audit Events" value={auditEventsToday.toLocaleString()} color="bg-muted" sparkData={auditSpark} index={3} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Live Activity Feed */}
        <motion.div {...fadeIn} transition={{ duration: 0.4, delay: 0.35 }}>
          <Card className="border-hairline bg-surface/60 dark:bg-surface/40 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" /><CardTitle className="text-base">Live Activity Feed</CardTitle></div>
              <Link to="/dashboard/activity"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">View all <ArrowRight className="ml-1 h-3 w-3" /></Button></Link>
            </CardHeader>
            <CardContent><LiveFeed /></CardContent>
          </Card>
        </motion.div>

        {/* Pending Approvals */}
        <motion.div {...fadeIn} transition={{ duration: 0.4, delay: 0.45 }}>
          <Card className="border-hairline bg-surface/60 dark:bg-surface/40 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Pending Approvals</CardTitle>
              <Link to="/dashboard/approvals"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Review <ArrowRight className="ml-1 h-3 w-3" /></Button></Link>
            </CardHeader>
            <CardContent>
              {approvals.filter((a) => a.status === "pending").length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 mb-3">
                    <CheckSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">All caught up — nothing needs your review right now.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {approvals.filter((a) => a.status === "pending").slice(0, 3).map((a, i) => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="flex items-center gap-3 rounded-xl border border-hairline bg-background/60 p-3 transition-colors hover:bg-surface/50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15"><Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{a.agentName}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.action} {a.resourceType}/{a.resource}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 rounded-full bg-green-600 text-white text-xs hover:bg-green-700" onClick={() => handleApprove(a.id)}>Approve</Button>
                          <Button size="sm" variant="destructive" className="h-7 rounded-full text-xs" onClick={() => handleDeny(a.id)}>Deny</Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
