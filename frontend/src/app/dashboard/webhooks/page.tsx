'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Send } from 'lucide-react';
import { webhooksApi } from '@/lib/api';

interface WebhookEntry {
  id: string;
  url: string;
  event_types: string[];
  status: string;
  created_at: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ url: '', event_types: [] as string[], secret: '' });
  const eventTypes = ['approval.decided', 'agent.revoked', 'grant.revoked'];

  useEffect(() => { fetchWebhooks(); }, []);

  const fetchWebhooks = async () => {
    const orgId = 'demo-org-id';
    const { data } = await webhooksApi.list(orgId);
    if (data) setWebhooks(data);
    setLoading(false);
  };

  const handleCreateWebhook = async () => {
    const orgId = 'demo-org-id';
    const { data } = await webhooksApi.create({ org_id: orgId, ...newWebhook });
    if (data) {
      fetchWebhooks();
      setShowCreateModal(false);
      setNewWebhook({ url: '', event_types: [], secret: '' });
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Delete this webhook?')) return;
    const { data } = await webhooksApi.delete(webhookId);
    if (data) fetchWebhooks();
  };

  const handleTestWebhook = async (webhookId: string) => {
    const { data } = await webhooksApi.test(webhookId);
    if (data) alert(data.success ? 'Test sent.' : `Failed: ${data.message}`);
  };

  const toggleEventType = (eventType: string) => {
    setNewWebhook({
      ...newWebhook,
      event_types: newWebhook.event_types.includes(eventType)
        ? newWebhook.event_types.filter((e) => e !== eventType)
        : [...newWebhook.event_types, eventType],
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Receive HTTP callbacks when events occur in your organization.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add webhook
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : webhooks.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-gray-900 mb-1">No webhooks</p>
            <p className="text-sm text-gray-500 mb-4">Add a webhook to receive event notifications.</p>
            <button onClick={() => setShowCreateModal(true)} className="text-sm text-gray-900 font-medium hover:underline">
              Add webhook
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="px-4 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${webhook.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {webhook.status}
                      </span>
                    </div>
                    <div className="text-sm font-mono text-gray-700 mb-1">{webhook.url}</div>
                    <div className="flex flex-wrap gap-1">
                      {webhook.event_types.map((type) => (
                        <span key={type} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{type}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleTestWebhook(webhook.id)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors" title="Send test">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteWebhook(webhook.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold">Add webhook</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Endpoint URL</label>
                <input type="url" value={newWebhook.url} onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="https://your-server.com/webhook" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Events</label>
                <div className="flex flex-wrap gap-2">
                  {eventTypes.map((type) => (
                    <button key={type} onClick={() => toggleEventType(type)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${newWebhook.event_types.includes(type) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Signing secret</label>
                <input type="text" value={newWebhook.secret} onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="Used to verify webhook signatures" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleCreateWebhook} className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">Add webhook</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
