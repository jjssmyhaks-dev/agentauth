import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { mockOrg } from "@/data/mock";
import { Settings, Shield, Clock, Globe, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const [org, setOrg] = useState(mockOrg);
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="text-2xl font-serif">Settings</h1><p className="text-sm text-muted-foreground">Configure your organization, policies, and security.</p></div>

      <Card className="border-hairline bg-surface/60">
        <CardHeader><div className="flex items-center gap-3"><Settings className="h-5 w-5" /><div><CardTitle className="text-base">Organization</CardTitle><CardDescription className="text-muted-foreground">Basic organization settings</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Organization Name</Label><Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} className="rounded-xl border-hairline bg-background" /></div>
          <div className="space-y-2"><Label>Organization ID</Label><Input value={org.id} disabled className="rounded-xl border-hairline bg-muted text-muted-foreground font-mono text-sm" /></div>
          <Button className="rounded-full bg-primary text-primary-foreground hover:opacity-90">Save Changes</Button>
        </CardContent>
      </Card>

      <Card className="border-hairline bg-surface/60">
        <CardHeader><div className="flex items-center gap-3"><Shield className="h-5 w-5" /><div><CardTitle className="text-base">Default Approval Policy</CardTitle><CardDescription className="text-muted-foreground">Set the default mode for new agents</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Default Mode</Label><Select value={org.defaultApprovalMode} onValueChange={(v) => setOrg({ ...org, defaultApprovalMode: v as any })}><SelectTrigger className="rounded-xl border-hairline bg-background"><SelectValue /></SelectTrigger><SelectContent className="border-hairline bg-surface"><SelectItem value="autonomous">Autonomous — agents run freely</SelectItem><SelectItem value="human-in-the-loop">Human-in-the-loop — agents wait for approval</SelectItem></SelectContent></Select></div>
          <Separator className="bg-hairline" />
          <div className="space-y-3"><Label>Per-Action Overrides</Label><div className="space-y-2">{["read", "write", "delete", "execute"].map((action) => (
            <div key={action} className="flex items-center justify-between"><span className="text-sm capitalize">{action}</span><Badge variant={action === "read" ? "info" : action === "delete" ? "warning" : "secondary"} className="text-xs">{action === "read" ? "Auto" : action === "delete" ? "HITL" : "Default"}</Badge></div>
          ))}</div></div>
        </CardContent>
      </Card>

      <Card className="border-hairline bg-surface/60">
        <CardHeader><div className="flex items-center gap-3"><Clock className="h-5 w-5" /><div><CardTitle className="text-base">Token Settings</CardTitle><CardDescription className="text-muted-foreground">Configure token lifetime</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><div className="flex justify-between"><Label>Token TTL</Label><span className="text-sm text-muted-foreground">{org.tokenTtlMinutes} minutes</span></div><input type="range" min={5} max={60} value={org.tokenTtlMinutes} onChange={(e) => setOrg({ ...org, tokenTtlMinutes: Number(e.target.value) })} className="w-full accent-foreground" /><div className="flex justify-between text-xs text-muted-foreground"><span>5 min</span><span>60 min</span></div></div>
        </CardContent>
      </Card>

      <Card className="border-hairline bg-surface/60">
        <CardHeader><div className="flex items-center gap-3"><Globe className="h-5 w-5" /><div><CardTitle className="text-base">Security</CardTitle><CardDescription className="text-muted-foreground">IP allowlist and access controls</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4"><div className="space-y-2"><Label>IP Allowlist</Label><Input placeholder="Add IP addresses, comma-separated" className="rounded-xl border-hairline bg-background" /><p className="text-xs text-muted-foreground">Leave empty to allow all IPs.</p></div></CardContent>
      </Card>

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader><div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-destructive" /><div><CardTitle className="text-base text-destructive">Danger Zone</CardTitle><CardDescription className="text-muted-foreground">Irreversible actions</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-hairline bg-background p-4"><div><p className="text-sm font-medium">Revoke all agent access</p><p className="text-xs text-muted-foreground">Immediately revoke all agent identities and tokens.</p></div><Button variant="destructive" size="sm" className="rounded-full">Revoke All</Button></div>
          <div className="flex items-center justify-between rounded-xl border border-hairline bg-background p-4"><div><p className="text-sm font-medium">Delete organization</p><p className="text-xs text-muted-foreground">Permanently delete this organization and all data.</p></div><Button variant="destructive" size="sm" className="rounded-full" onClick={() => setShowDangerConfirm(true)}>Delete Org</Button></div>
        </CardContent>
      </Card>

      <Dialog open={showDangerConfirm} onOpenChange={setShowDangerConfirm}>
        <DialogContent className="border-hairline bg-surface"><DialogHeader><DialogTitle className="text-destructive">Delete Organization</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Type <strong>DELETE</strong> to confirm.</p>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE" className="rounded-xl border-hairline bg-background" />
          <DialogFooter><Button variant="outline" onClick={() => setShowDangerConfirm(false)} className="rounded-full border-hairline">Cancel</Button><Button variant="destructive" disabled={confirmText !== "DELETE"} onClick={() => setShowDangerConfirm(false)}>Delete Organization</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
