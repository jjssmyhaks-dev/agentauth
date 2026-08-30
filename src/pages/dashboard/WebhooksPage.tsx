import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useDashboard } from "@/context/DashboardContext";
import { Plus, Globe, Pause, Play, Send, Copy, Check } from "lucide-react";

export default function WebhooksPage() {
  const { webhooks, addWebhook, pauseWebhook } = useDashboard();
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("approval.decided,agent.revoked");
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    addWebhook({ id: "wh_" + Date.now().toString(36), url, eventTypes: events.split(",").map((e) => e.trim()), status: "active", lastDeliveryAt: null, secret: "whsec_" + Math.random().toString(36).slice(2, 16), createdAt: new Date().toISOString() });
    setUrl(""); setShowCreate(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-serif">Webhooks</h1><p className="text-sm text-muted-foreground">Get notified the moment an approval is decided or an agent's access changes.</p></div>
        <Button onClick={() => setShowCreate(true)} className="rounded-full bg-primary text-primary-foreground hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> Add Webhook</Button>
      </div>
      <Card className="border-hairline bg-surface/60">
        <CardContent className="p-0">
          {webhooks.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No webhooks configured. Add one to get notified the moment an approval is decided or an agent's access changes.</p>
          ) : (
            <div className="divide-y divide-hairline/50">
              {webhooks.map((wh) => (
                <div key={wh.id} className="flex items-center gap-4 p-4 hover:bg-foreground/[0.02]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Globe className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><p className="font-mono text-sm truncate">{wh.url}</p><Badge variant={wh.status === "active" ? "success" : "warning"}>{wh.status}</Badge></div>
                    <div className="mt-1.5 flex flex-wrap gap-1">{wh.eventTypes.map((et) => <Badge key={et} variant="outline" className="text-xs">{et}</Badge>)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Secret: {wh.secret}</p>
                  </div>
                  <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Send className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => pauseWebhook(wh.id)}>{wh.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</Button></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-hairline bg-surface">
          <DialogHeader><DialogTitle>Add Webhook</DialogTitle><DialogDescription className="text-muted-foreground">Send HTTP POST to your endpoint on agent events.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>URL</Label><Input placeholder="https://your-app.com/webhooks/agentauth" value={url} onChange={(e) => setUrl(e.target.value)} className="rounded-xl border-hairline bg-background" /></div>
            <div className="space-y-2"><Label>Event Types (comma-separated)</Label><Input placeholder="approval.decided, agent.revoked" value={events} onChange={(e) => setEvents(e.target.value)} className="rounded-xl border-hairline bg-background" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-full border-hairline">Cancel</Button><Button onClick={handleCreate} disabled={!url} className="rounded-full bg-primary text-primary-foreground hover:opacity-90">Add Webhook</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
