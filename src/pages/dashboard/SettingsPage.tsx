import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Configure your organization, policies, and security.</p>
      </div>

      {/* Organization */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-blue-400" />
            <div>
              <CardTitle className="text-base text-white">Organization</CardTitle>
              <CardDescription className="text-slate-400">Basic organization settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Organization Name</Label>
            <Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} className="border-slate-700 bg-slate-800 text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Organization ID</Label>
            <Input value={org.id} disabled className="border-slate-700 bg-slate-800 text-white font-mono text-sm" />
          </div>
          <Button className="bg-blue-600 text-white hover:bg-blue-700">Save Changes</Button>
        </CardContent>
      </Card>

      {/* Default Approval Policy */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-emerald-400" />
            <div>
              <CardTitle className="text-base text-white">Default Approval Policy</CardTitle>
              <CardDescription className="text-slate-400">Set the default mode for new agents</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Default Mode</Label>
            <Select value={org.defaultApprovalMode} onValueChange={(v) => setOrg({ ...org, defaultApprovalMode: v as any })}>
              <SelectTrigger className="border-slate-700 bg-slate-800 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-800">
                <SelectItem value="autonomous">⚡ Autonomous — agents run freely</SelectItem>
                <SelectItem value="human-in-the-loop">🛡️ Human-in-the-loop — agents wait for approval</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator className="bg-slate-800" />
          <div className="space-y-3">
            <Label className="text-slate-300">Per-Action Overrides</Label>
            <div className="space-y-2">
              {["read", "write", "delete", "execute"].map((action) => (
                <div key={action} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 capitalize">{action}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{action === "read" ? "Autonomous" : action === "delete" ? "HITL" : "Follow default"}</span>
                    <Badge variant={action === "read" ? "info" : action === "delete" ? "warning" : "secondary"} className="text-xs">
                      {action === "read" ? "Auto" : action === "delete" ? "HITL" : "Default"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Settings */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-400" />
            <div>
              <CardTitle className="text-base text-white">Token Settings</CardTitle>
              <CardDescription className="text-slate-400">Configure token lifetime</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-slate-300">Token TTL</Label>
              <span className="text-sm text-slate-400">{org.tokenTtlMinutes} minutes</span>
            </div>
            <input
              type="range" min={5} max={60} value={org.tokenTtlMinutes}
              onChange={(e) => setOrg({ ...org, tokenTtlMinutes: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-slate-500"><span>5 min</span><span>60 min</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-purple-400" />
            <div>
              <CardTitle className="text-base text-white">Security</CardTitle>
              <CardDescription className="text-slate-400">IP allowlist and access controls</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">IP Allowlist</Label>
            <Input placeholder="Add IP addresses, comma-separated" className="border-slate-700 bg-slate-800 text-white" />
            <p className="text-xs text-slate-500">Leave empty to allow all IPs. Add specific IPs to restrict access.</p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div>
              <CardTitle className="text-base text-red-400">Danger Zone</CardTitle>
              <CardDescription className="text-slate-400">Irreversible actions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-red-500/20 p-4">
            <div>
              <p className="text-sm font-medium text-white">Revoke all agents</p>
              <p className="text-xs text-slate-400">Immediately revoke all agent identities and tokens.</p>
            </div>
            <Button variant="destructive" size="sm">Revoke All</Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-red-500/20 p-4">
            <div>
              <p className="text-sm font-medium text-white">Delete organization</p>
              <p className="text-xs text-slate-400">Permanently delete this organization and all data.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setShowDangerConfirm(true)}>Delete Org</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDangerConfirm} onOpenChange={setShowDangerConfirm}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader><DialogTitle className="text-red-400">Delete Organization</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-400 py-2">Type <strong>DELETE</strong> to confirm.</p>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE" className="border-slate-700 bg-slate-800 text-white" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDangerConfirm(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button variant="destructive" disabled={confirmText !== "DELETE"} onClick={() => setShowDangerConfirm(false)}>Delete Organization</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
