'use client';

import { useEffect, useState } from 'react';
import { Plus, RotateCw, Ban, Search } from 'lucide-react';
import { TableSkeleton } from '@/components/loading-skeleton';
import { agentsApi } from '@/lib/api';

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', public_key: '' });
  const [orgId] = useState('00000000-0000-0000-0000-000000000001');
  const [search, setSearch] = useState('');

  useEffect(() => { loadAgents(); }, []);

  async function loadAgents() {
    setLoading(true);
    const res = await agentsApi.list(orgId);
    setAgents(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }

  async function createAgent() {
    if (!newAgent.name || !newAgent.public_key) return;
    await agentsApi.create({ org_id: orgId, name: newAgent.name, public_key: newAgent.public_key });
    setNewAgent({ name: '', public_key: '' });
    setShowCreate(false);
    loadAgents();
  }

  async function revokeAgent(id: string) {
    if (!confirm('Revoke this agent? This cannot be undone.')) return;
    await agentsApi.revoke(id);
    loadAgents();
  }

  const filtered = agents.filter((a) => a.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Agents</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your registered AI agents.</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register agent
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">New agent</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Agent name"
              value={newAgent.name}
              onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
            />
            <input
              placeholder="Ed25519 public key (base64)"
              value={newAgent.public_key}
              onChange={(e) => setNewAgent({ ...newAgent, public_key: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createAgent} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100">
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400">No agents registered yet. Create your first agent to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((agent) => (
            <div key={agent.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-lg">🤖</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{agent.name}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">{agent.id}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  agent.status === 'active'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {agent.status}
                </span>
                <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Rotate key">
                  <RotateCw className="w-4 h-4 text-gray-400" />
                </button>
                {agent.status === 'active' && (
                  <button onClick={() => revokeAgent(agent.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Revoke">
                    <Ban className="w-4 h-4 text-red-400" />
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
