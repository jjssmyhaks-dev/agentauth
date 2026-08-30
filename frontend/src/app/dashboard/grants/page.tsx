'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TableSkeleton } from '@/components/loading-skeleton';
import { grantsApi } from '@/lib/api';

export default function GrantsPage() {
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ resource_type: '', resource_pattern: '', allowed_actions: 'read,write', usage_cap: '' });

  useEffect(() => {
    if (agentId) loadGrants();
  }, [agentId]);

  async function loadGrants() {
    setLoading(true);
    const res = await grantsApi.list(agentId);
    setGrants(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }

  async function createGrant() {
    if (!agentId || !form.resource_type) return;
    await grantsApi.create({
      agent_id: agentId,
      resource_type: form.resource_type,
      resource_pattern: form.resource_pattern || '*',
      allowed_actions: form.allowed_actions.split(',').map((s) => s.trim()),
      created_by_user_id: '00000000-0000-0000-0000-000000000001',
      usage_cap: form.usage_cap ? parseInt(form.usage_cap) : undefined,
    });
    setShowCreate(false);
    setForm({ resource_type: '', resource_pattern: '', allowed_actions: 'read,write', usage_cap: '' });
    loadGrants();
  }

  async function revokeGrant(id: string) {
    await grantsApi.revoke(id);
    loadGrants();
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">Grants</h1>
          <p >Manage permission grants for your agents.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-90">
          <Plus className="w-4 h-4" /> New grant
        </button>
      </div>

      <div className="mb-4">
        <input
          placeholder="Enter agent ID to view grants..."
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
        />
      </div>

      {showCreate && (
        <div className="border border-hairline bg-surface p-5 mb-6">
          <h3 className="text-lg mb-4">New grant</h3>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Resource type (e.g. database)" value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
            <input placeholder="Resource pattern (e.g. users/*)" value={form.resource_pattern} onChange={(e) => setForm({ ...form, resource_pattern: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
            <input placeholder="Allowed actions (comma-sep)" value={form.allowed_actions} onChange={(e) => setForm({ ...form, allowed_actions: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
            <input placeholder="Usage cap (optional)" value={form.usage_cap} onChange={(e) => setForm({ ...form, usage_cap: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createGrant} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-hairline text-sm text-muted-foreground hover:bg-surface">Cancel</button>
          </div>
        </div>
      )}

      {!agentId ? (
        <div className="border border-hairline bg-surface p-16 text-center">
          <p className="text-muted-foreground">Enter an agent ID above to view its grants.</p>
        </div>
      ) : loading ? (
        <TableSkeleton />
      ) : grants.length === 0 ? (
        <div className="border border-hairline bg-surface p-16 text-center">
          <p className="text-muted-foreground">No grants found for this agent.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grants.map((grant) => (
            <div key={grant.id} className="bg-background border border-hairline p-5 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{grant.resource_type}:{grant.resource_pattern}</div>
                <div className="flex gap-1 mt-1">
                  {(grant.allowed_actions || []).map((a: string) => (
                    <span key={a} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{a}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {grant.usage_count || 0}{grant.usage_cap ? `/${grant.usage_cap}` : ''} uses
                  {grant.expires_at && ` · expires ${new Date(grant.expires_at).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  grant.status === 'active' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  grant.status === 'revoked' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>{grant.status}</span>
                {grant.status === 'active' && (
                  <button onClick={() => revokeGrant(grant.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Revoke">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
