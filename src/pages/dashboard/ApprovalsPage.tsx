import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useDashboard } from "@/context/DashboardContext";
import { CheckCircle2, XCircle, Clock, Shield } from "lucide-react";

export default function ApprovalsPage() {
  const { approvals, approveRequest, denyRequest } = useDashboard();
  const [tab, setTab] = useState("pending");
  const [denyId, setDenyId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");

  const filtered = approvals.filter((a) => tab === "all" || a.status === tab);

  const handleDeny = () => {
    if (denyId && denyReason) {
      denyRequest(denyId, denyReason);
      setDenyId(null);
      setDenyReason("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Approvals</h1>
        <p className="text-sm text-slate-400">Review and decide on pending agent action requests.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="pending">Pending ({approvals.filter((a) => a.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approvals.filter((a) => a.status === "approved").length})</TabsTrigger>
          <TabsTrigger value="denied">Denied ({approvals.filter((a) => a.status === "denied").length})</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-4">
          {filtered.length === 0 ? (
            <Card className="border-slate-800 bg-slate-900/50"><CardContent className="p-12 text-center text-slate-500">
              {tab === "pending" ? "No pending approvals — all caught up!" : `No ${tab} approvals.`}
            </CardContent></Card>
          ) : (
            filtered.map((a) => (
              <Card key={a.id} className="border-slate-800 bg-slate-900/50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.status === "pending" ? "bg-amber-500/15" : a.status === "approved" ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                      {a.status === "pending" ? <Clock className="h-5 w-5 text-amber-400" /> : a.status === "approved" ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-white">{a.agentName}</h3>
                        <Badge variant={a.status === "pending" ? "warning" : a.status === "approved" ? "success" : "destructive"}>{a.status}</Badge>
                        <Badge variant="outline">{a.action} {a.resourceType}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-400 font-mono bg-slate-800/50 rounded-lg p-3">{a.context}</p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                        <span>Resource: {a.resource}</span>
                        <span>Requested: {new Date(a.requestedAt).toLocaleString()}</span>
                        {a.decidedAt && <span>Decided: {new Date(a.decidedAt).toLocaleString()}</span>}
                        {a.decidedBy && <span>By: {a.decidedBy}</span>}
                      </div>
                      {a.denialReason && (
                        <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-400">
                          Denial reason: {a.denialReason}
                        </div>
                      )}
                    </div>
                    {a.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => approveRequest(a.id)}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDenyId(a.id)}>
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Deny
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!denyId} onOpenChange={() => setDenyId(null)}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Deny Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea placeholder="Reason for denial..." value={denyReason} onChange={(e) => setDenyReason(e.target.value)} className="border-slate-700 bg-slate-800 text-white" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyId(null)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button variant="destructive" onClick={handleDeny} disabled={!denyReason}>Deny with reason</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
