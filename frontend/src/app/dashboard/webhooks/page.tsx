'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Send } from 'lucide-react';
import { TableSkeleton } from '@/components/loading-skeleton';
import { webhooksApi } from '@/lib/api';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ url: '', event_types: 'approval.decided,agent.revoked', secret: '' });
  const [orgId] = useState('00000000-0000-0000-0000-000000000001');

  useEffect(() => { loadWebhooks(); }, []);

  async function loadWebhooks() {
    setLoading(true);
    const res = await webhooksApi.list(orgId);
    setWebhooks(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }

  async function createWebhook() {
    if (!form.url) return;
    await webhooksApi.create({
      org_id: orgId,
      url: form.url,
      event_types: form.event_types.split(',').map((s) => s.trim()),
      secret: form.secret || Math.random().toString(36).substring(2),
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
    alert('Test webhook sent!');
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Webhooks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure event delivery endpoints.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">
          <Plus className="w-4 h-4" /> Add webhook
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">New webhook</h3>
          <div className="space-y-3">
            <input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
            <input placeholder="Event types (comma-sep)" value={form.event_types} onChange={(e) => setForm({ ...form, event_types: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
            <input placeholder="Secret (auto-generated if empty)" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createWebhook} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <TableSkeleton /> : webhooks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400">No webhooks configured yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white font-mono text-sm">{wh.url}</div>
                <div className="flex gap-1 mt-1">
                  {(wh.event_types || []).map((t: string) => (
                    <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => testWebhook(wh.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Test">
                  <Send className="w-4 h-4 text-gray-400" />
                </button>
                <button onClick={() => deleteWebhook(wh.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
