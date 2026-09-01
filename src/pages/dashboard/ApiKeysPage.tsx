import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useDashboard } from "@/context/DashboardContext";
import { Plus, Key, Copy, Check, Eye, EyeOff } from "lucide-react";

export default function ApiKeysPage() {
  const { apiKeys, addApiKey, revokeApiKey } = useDashboard();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRevoke, setShowRevoke] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(true);

  const handleCreate = () => {
    const fullKey = "aa_live_" + Math.random().toString(36).slice(2, 18);
    addApiKey({ id: "key_" + Date.now().toString(36), name, prefix: fullKey.slice(0, 8) + "••••" + fullKey.slice(-4), createdAt: new Date().toISOString(), lastUsedAt: null, status: "active" });
    setNewKey(fullKey); setName(""); setShowCreate(false);
  };

  const handleCopy = async () => { if (newKey) { try { await navigator.clipboard.writeText(newKey); } catch { /* fallback */ } setCopied(true); setTimeout(() => setCopied(false), 2000); } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-serif">API Keys</h1><p className="text-sm text-muted-foreground">Manage API keys for dashboard and programmatic access.</p></div>
        <Button onClick={() => setShowCreate(true)} className="rounded-full bg-primary text-primary-foreground hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> New API Key</Button>
      </div>
      {newKey && (
        <Card className="border-green-500/30 bg-green-500/10"><CardContent className="p-5 flex items-center justify-between">
          <div><p className="text-sm font-medium text-green-700 dark:text-green-300">API Key Created</p><p className="mt-1 text-xs text-muted-foreground">Copy this key now — you won't be able to see it again.</p>
            <div className="mt-3 flex items-center gap-2"><code className="rounded-xl bg-white border border-hairline px-3 py-1.5 font-mono text-sm">{showKey ? newKey : "••••••••••••••••"}</code><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>{copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}</Button></div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setNewKey(null)}>Dismiss</Button>
        </CardContent></Card>
      )}
      <Card className="border-hairline bg-surface/60">
        <CardContent className="p-0">
          {apiKeys.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No API keys yet. You'll need one to authenticate your dashboard/API integrations.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-hairline text-left"><th className="p-4 eyebrow">Name</th><th className="p-4 eyebrow">Key</th><th className="p-4 eyebrow">Created</th><th className="p-4 eyebrow">Last Used</th><th className="p-4 eyebrow">Status</th><th className="p-4 eyebrow text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-hairline/50">{apiKeys.map((k) => (
                <tr key={k.id} className="hover:bg-foreground/[0.02]">
                  <td className="p-4 font-medium">{k.name}</td><td className="p-4 font-mono text-xs text-muted-foreground">{k.prefix}</td><td className="p-4 text-xs text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</td><td className="p-4 text-xs text-muted-foreground">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td><td className="p-4"><Badge variant={k.status === "active" ? "success" : "destructive"}>{k.status}</Badge></td><td className="p-4 text-right">{k.status === "active" && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowRevoke(k.id)}>Revoke</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-hairline bg-surface"><DialogHeader><DialogTitle>New API Key</DialogTitle><DialogDescription className="text-muted-foreground">Generate a new API key for programmatic access.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4"><div className="space-y-2"><Label>Name</Label><Input placeholder="e.g., Production Backend" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border-hairline bg-background" /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-full border-hairline">Cancel</Button><Button onClick={handleCreate} disabled={!name} className="rounded-full bg-primary text-primary-foreground hover:opacity-90"><Key className="mr-2 h-4 w-4" /> Generate Key</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!showRevoke} onOpenChange={() => setShowRevoke(null)}>
        <DialogContent className="border-hairline bg-surface"><DialogHeader><DialogTitle>Revoke API Key</DialogTitle><DialogDescription className="text-muted-foreground">This key will be immediately invalidated.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setShowRevoke(null)} className="rounded-full border-hairline">Cancel</Button><Button variant="destructive" onClick={() => { if (showRevoke) { revokeApiKey(showRevoke); setShowRevoke(null); } }}>Revoke</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
