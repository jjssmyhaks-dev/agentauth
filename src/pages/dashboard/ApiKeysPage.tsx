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
    addApiKey({
      id: "key_" + Date.now().toString(36), name, prefix: fullKey.slice(0, 8) + "••••" + fullKey.slice(-4),
      createdAt: new Date().toISOString(), lastUsedAt: null, status: "active",
    });
    setNewKey(fullKey);
    setName("");
    setShowCreate(false);
  };

  const handleCopy = () => {
    if (newKey) { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-sm text-slate-400">Manage API keys for dashboard and programmatic access.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> New API Key</Button>
      </div>

      {newKey && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-400">API Key Created</p>
                <p className="mt-1 text-xs text-slate-400">Copy this key now — it won't be shown again.</p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="rounded bg-slate-800 px-3 py-1.5 font-mono text-sm text-white">{showKey ? newKey : "••••••••••••••••"}</code>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => setNewKey(null)}>Dismiss</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-left">
              <th className="p-4 font-medium text-slate-400">Name</th>
              <th className="p-4 font-medium text-slate-400">Key</th>
              <th className="p-4 font-medium text-slate-400">Created</th>
              <th className="p-4 font-medium text-slate-400">Last Used</th>
              <th className="p-4 font-medium text-slate-400">Status</th>
              <th className="p-4 font-medium text-slate-400 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-800">
              {apiKeys.map((k) => (
                <tr key={k.id} className="hover:bg-slate-800/30">
                  <td className="p-4 font-medium text-white">{k.name}</td>
                  <td className="p-4 font-mono text-xs text-slate-300">{k.prefix}</td>
                  <td className="p-4 text-xs text-slate-400">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-xs text-slate-400">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td>
                  <td className="p-4"><Badge variant={k.status === "active" ? "success" : "destructive"}>{k.status}</Badge></td>
                  <td className="p-4 text-right">
                    {k.status === "active" && (
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => setShowRevoke(k.id)}>Revoke</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader><DialogTitle>Create API Key</DialogTitle><DialogDescription className="text-slate-400">Generate a new API key for programmatic access.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Key Name</Label>
              <Input placeholder="e.g., Production Backend" value={name} onChange={(e) => setName(e.target.value)} className="border-slate-700 bg-slate-800 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={handleCreate} disabled={!name} className="bg-blue-600 text-white hover:bg-blue-700"><Key className="mr-2 h-4 w-4" /> Generate Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showRevoke} onOpenChange={() => setShowRevoke(null)}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader><DialogTitle>Revoke API Key</DialogTitle><DialogDescription className="text-slate-400">This key will be immediately invalidated. Any requests using it will fail.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevoke(null)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button variant="destructive" onClick={() => { if (showRevoke) { revokeApiKey(showRevoke); setShowRevoke(null); } }}>Revoke Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
