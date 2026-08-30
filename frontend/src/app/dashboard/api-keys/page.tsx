'use client';

import { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Copy, Check } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  status: 'active' | 'revoked';
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([
    // Demo data — in production, fetched from API
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function createKey() {
    if (!newKeyName) return;
    const prefix = 'aa_live_';
    const suffix = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const fullKey = `${prefix}${suffix}`;
    const newKey: ApiKey = {
      id: crypto.randomUUID(),
      name: newKeyName,
      prefix: `${prefix}${suffix.substring(0, 4)}••••${suffix.substring(suffix.length - 4)}`,
      created_at: new Date().toISOString(),
      last_used_at: null,
      status: 'active',
    };
    setKeys([...keys, newKey]);
    setRevealedKey(fullKey);
    setNewKeyName('');
    setShowCreate(false);
  }

  function revokeKey(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    setKeys(keys.map((k) => k.id === id ? { ...k, status: 'revoked' } : k));
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">API Keys</h1>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setRevealedKey(null); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          New API Key
        </button>
      </div>

      {showCreate && (
        <div className="border border-hairline bg-surface p-5 mb-6">
          <h3 className="text-lg mb-4">Generate API Key</h3>
          <div className="space-y-3">
            <input
              placeholder="Key name (e.g. production, staging)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full px-3 py-2 border border-hairline bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createKey} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90">
              Generate Key
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-hairline text-sm text-muted-foreground hover:bg-surface">
              Cancel
            </button>
          </div>
        </div>
      )}

      {revealedKey && (
        <div className="border border-primary bg-primary/5 p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Your API Key</h3>
            <button onClick={() => setRevealedKey(null)} className="text-muted-foreground hover:text-foreground text-sm">Dismiss</button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Copy this key now — you won&apos;t be able to see it again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-background border border-hairline text-sm font-mono break-all">{revealedKey}</code>
            <button onClick={() => copyKey(revealedKey)} className="p-2 hover:bg-surface transition-colors shrink-0">
              {copiedId === revealedKey ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="border border-hairline bg-surface p-16 text-center">
          <p className="text-muted-foreground">No API keys yet. You&apos;ll need one to authenticate your dashboard/API integrations.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-hairline bg-hairline">
          <table className="w-full">
            <thead>
              <tr className="bg-surface">
                <th className="text-left px-4 py-3 text-xs eyebrow">Name</th>
                <th className="text-left px-4 py-3 text-xs eyebrow">Key</th>
                <th className="text-left px-4 py-3 text-xs eyebrow">Created</th>
                <th className="text-left px-4 py-3 text-xs eyebrow">Last Used</th>
                <th className="text-left px-4 py-3 text-xs eyebrow">Status</th>
                <th className="text-right px-4 py-3 text-xs eyebrow">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="bg-background rule-x">
                  <td className="px-4 py-3 text-sm font-medium">{key.name}</td>
                  <td className="px-4 py-3">
                    <code className="text-sm font-mono text-muted-foreground">{key.prefix}</code>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(key.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 ${key.status === 'active' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {key.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {key.status === 'active' && (
                      <button onClick={() => revokeKey(key.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Revoke">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
