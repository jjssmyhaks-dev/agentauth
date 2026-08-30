import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useDashboard } from "@/context/DashboardContext";
import { Plus, Globe, Pause, Play, Trash2, Send } from "lucide-react";

export default function WebhooksPage() {
  const { webhooks, addWebhook, pauseWebhook } = useDashboard();
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("approval.decided,agent.revoked");

  const handleCreate = () => {
    addWebhook({
      id: "wh_" + Date.now().toString(36), url, eventTypes: events.split(",").map((e) => e.trim()),
      status: "active", lastDeliveryAt: null, secret: "whsec_" + Math.random().toString(36).slice(2, 16),
      createdAt: new Date().toISOString(),
    });
    setUrl(""); setEvents(""); setShowCreate(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhooks</h1>
          <p className="text-sm text-slate-400">Receive notifications for agent events via HTTP callbacks.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Add Webhook</Button>
      </div>

      <div className="space-y-4">
        {webhooks.map((wh) => (
          <Card key={wh.id} className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15">
                  <Globe className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm text-white truncate">{wh.url}</p>
                    <Badge variant={wh.status === "active" ? "success" : wh.status === "paused" ? "warning" : "destructive"}>{wh.status}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {wh.eventTypes.map((et) => <Badge key={et} variant="outline" className="text-xs">{et}</Badge>)}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                    <span>Secret: {wh.secret}</span>
                    {wh.lastDeliveryAt && <span>Last delivery: {new Date(wh.lastDeliveryAt).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" title="Send test"><Send className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => pauseWebhook(wh.id)} title={wh.status === "active" ? "Pause" : "Resume"}>
                    {wh.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription className="text-slate-400">Send HTTP POST to your endpoint on agent events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Endpoint URL</Label>
              <Input placeholder="https://your-app.com/webhooks/agentauth" value={url} onChange={(e) => setUrl(e.target.value)} className="border-slate-700 bg-slate-800 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Event Types (comma-separated)</Label>
              <Input placeholder="approval.decided, agent.revoked" value={events} onChange={(e) => setEvents(e.target.value)} className="border-slate-700 bg-slate-800 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={handleCreate} disabled={!url} className="bg-blue-600 text-white hover:bg-blue-700">Add Webhook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
