import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useDashboard } from "@/context/DashboardContext";
import { useNotifications } from "@/context/NotificationContext";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function TimeAgo({ date, slaMinutes = 60 }: { date: string; slaMinutes?: number }) {
  const [text, setText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => {
      const diffMs = Date.now() - new Date(date).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      setElapsed(diffMin);
      setText(diffMin < 1 ? "just now" : diffMin < 60 ? `waiting ${diffMin}m` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`);
    };
    update();
    const i = setInterval(update, 15000);
    return () => clearInterval(i);
  }, [date]);
  const pct = Math.min((elapsed / slaMinutes) * 100, 100);
  const isBreached = elapsed >= slaMinutes;
  const isWarning = elapsed >= slaMinutes * 0.75 && !isBreached;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${isBreached ? "text-red-600 dark:text-red-400 font-medium" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{text}</span>
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${isBreached ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { approvals, approveRequest, denyRequest } = useDashboard();
  const { addNotification, pushToast } = useNotifications();
  const [tab, setTab] = useState("pending");
  const [denyId, setDenyId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const filtered = approvals.filter((a) => tab === "all" || a.status === tab);

  const handleApprove = useCallback((id: string) => {
    const approval = approvals.find((a) => a.id === id);
    approveRequest(id);
    if (approval) {
      addNotification({
        type: "approval",
        priority: "medium",
        title: `Approved: ${approval.action} on ${approval.resourceType}`,
        message: `${approval.agentName} request for ${approval.resource} has been approved`,
        agentId: approval.agentId,
        agentName: approval.agentName,
        actionUrl: `/dashboard/approvals`,
      });
      pushToast({ type: "approval", priority: "medium", title: "Request approved", message: `${approval.agentName} — ${approval.action} ${approval.resource}` });
    }
  }, [approvals, approveRequest, addNotification, pushToast]);

  const handleDeny = useCallback(() => {
    if (!denyId || !denyReason) return;
    const approval = approvals.find((a) => a.id === denyId);
    denyRequest(denyId, denyReason);
    if (approval) {
      addNotification({
        type: "approval",
        priority: "medium",
        title: `Denied: ${approval.action} on ${approval.resourceType}`,
        message: `${approval.agentName} request for ${approval.resource} was denied — ${denyReason}`,
        agentId: approval.agentId,
        agentName: approval.agentName,
        actionUrl: `/dashboard/approvals`,
      });
    }
    setDenyId(null);
    setDenyReason("");
  }, [denyId, denyReason, approvals, denyRequest, addNotification]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-serif">Approvals</h1>
        <p className="text-sm text-muted-foreground">Review and decide on pending agent action requests.</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted border border-hairline">
            <TabsTrigger value="pending">Pending ({approvals.filter((a) => a.status === "pending").length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approvals.filter((a) => a.status === "approved").length})</TabsTrigger>
            <TabsTrigger value="denied">Denied ({approvals.filter((a) => a.status === "denied").length})</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="space-y-4">
            {filtered.length === 0 ? (
              <Card className="border-hairline bg-surface/60"><CardContent className="py-12 text-center text-sm text-muted-foreground">
                {tab === "pending" ? "All caught up — nothing needs your review right now." : `No ${tab} approvals.`}
              </CardContent></Card>
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((a, i) => (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Card className="border-hairline bg-surface/60 transition-shadow hover:shadow-md hover:shadow-foreground/5">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.3, delay: i * 0.04 + 0.1 }}
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.status === "pending" ? "bg-amber-500/15" : a.status === "approved" ? "bg-green-500/15" : "bg-red-500/15"}`}
                          >                              {a.status === "pending" ? <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" /> : a.status === "approved" ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" /> : <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="font-medium">{a.agentName}</h3>
                              <Badge variant={a.status === "pending" ? "warning" : a.status === "approved" ? "success" : "destructive"}>{a.status}</Badge>
                              <Badge variant="outline">{a.action} {a.resourceType}</Badge>
                            </div>
                            <p className="mt-2 text-sm font-mono text-muted-foreground bg-muted/50 rounded-xl p-3 border border-hairline/50">{a.context}</p>
                            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Resource: {a.resource}</span>
                              {a.status === "pending" && <TimeAgo date={a.requestedAt} />}
                              {a.decidedAt && <span>Decided: {new Date(a.decidedAt).toLocaleString()}</span>}
                              {a.decidedBy && <span>By: {a.decidedBy}</span>}
                            </div>
                            {a.denialReason && <div className="mt-2 rounded-xl border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">Reason: {a.denialReason}</div>}
                          </div>
                          {a.status === "pending" && (
                            <div className="flex gap-1.5">
                              <Button size="sm" className="h-8 rounded-full bg-green-600 text-white text-xs hover:bg-green-700" onClick={() => handleApprove(a.id)}>Approve</Button>
                              <Button size="sm" variant="destructive" className="h-8 rounded-full text-xs" onClick={() => setDenyId(a.id)}>Deny</Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
      <Dialog open={!!denyId} onOpenChange={() => setDenyId(null)}>
        <DialogContent className="border-hairline bg-surface">
          <DialogHeader><DialogTitle>Deny Request</DialogTitle></DialogHeader>
          <div className="py-4"><Textarea placeholder="Reason for denial..." value={denyReason} onChange={(e) => setDenyReason(e.target.value)} className="rounded-xl border-hairline bg-background" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setDenyId(null)} className="rounded-full border-hairline">Cancel</Button><Button variant="destructive" onClick={handleDeny} disabled={!denyReason}>Deny</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
