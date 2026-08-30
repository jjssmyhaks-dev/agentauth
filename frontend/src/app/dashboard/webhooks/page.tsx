'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Send } from 'lucide-react';
import { webhooksApi } from '@/lib/api';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ url: '', event_types: 'approval.decided,agent.revoked', secret: '' });
  const [orgId] = useState('00000000-0000-0000-0000-000000000001');
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);

  useEffect(() => { loadWebhooks(); }, []);

  async function loadWebhooks() {
    setLoading(true);
    const res = await webhooksApi.list(orgId);
    setWebhooks(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }

  async function createWebhook() {
    if (!form.url) return;
    const secret = form.secret || crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    await webhooksApi.create({
      org_id: orgId,
      url: form.url,
      event_types: form.event_types.split(',').map((s) => s.trim()),
      secret,
    });
    setShowCreate(false);
    setForm({ url: '', event_types: 'approval.decided,agent.revoked', secret: '' });
    loadWebhooks();
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook?')) return;
    await webhooksApi.delete(id);
    loadWebhooks();
  }

  async function testWebhook(id: string) {
    await webhooksApi.test(id);
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">Webhooks</h1>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      {showCreate && (
        <div className="border border-hairline bg-surface p-5 mb-6">
          <h3 className="text-lg mb-4">New Webhook</h3>
          <div className="space-y-3">
            <input
              placeholder="URL (e.g. https://your-server.com/webhook)"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 border border-hairline bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              placeholder="Event types (comma-separated: approval.decided, agent.revoked, grant.revoked, agent.created)"
              value={form.event_types}
              onChange={(e) => setForm({ ...form, event_types: e.target.value })}
              className="w-full px-3 py-2 border border-hairline bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div>
              <input
                placeholder="Secret (auto-generated if empty)"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                className="w-full px-3 py-2 border border-hairline bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">Used to sign webhook payloads with HMAC-SHA256. Verify via the <code>X-AgentAuth-Signature</code> header.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createWebhook} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90">
              Add Webhook
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-hairline text-sm text-muted-foreground hover:bg-surface">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="border border-hairline bg-surface p-8 text-center text-muted-foreground">Loading…</div>
      ) : webhooks.length === 0 ? (
        <div className="border border-hairline bg-surface p-16 text-center">
          <p className="text-muted-foreground">No webhooks configured. Add one to get notified the moment an approval is decided or an agent&apos;s access changes.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-hairline bg-hairline">
          <table className="w-full">
            <thead>
              <tr className="bg-surface">
                <th className="text-left px-4 py-3 text-xs eyebrow">URL</th>
                <th className="text-left px-4 py-3 text-xs eyebrow">Event Types</th>
                <th className="text-left px-4 py-3 text-xs eyebrow">Status</th>
                <th className="text-left px-4 py-3 text-xs eyebrow">Last Delivery</th>
                <th className="text-right px-4 py-3 text-xs eyebrow">Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((wh) => (
                <tr key={wh.id} className="bg-background rule-x">
                  <td className="px-4 py-3">
                    <div className="text-sm font-mono truncate max-w-xs">{wh.url}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(wh.event_types || []).map((t: string) => (
                        <span key={t} className="text-xs px-2 py-0.5 bg-surface">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {wh.last_delivery_at ? new Date(wh.last_delivery_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => testWebhook(wh.id)} className="p-1.5 hover:bg-surface transition-colors" title="Send Test Event">
                        <Send className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => deleteWebhook(wh.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
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
