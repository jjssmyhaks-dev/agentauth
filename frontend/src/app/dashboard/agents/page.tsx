'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, RotateCw, Ban, Search } from 'lucide-react';
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
          <h1 className="text-2xl">Agents</h1>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-medium rounded-full transition-opacity hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </button>
      </div>

      {showCreate && (
        <div className="border border-hairline bg-surface p-5 mb-6">
          <h3 className="text-lg mb-4">New Agent</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Agent name"
              value={newAgent.name}
              onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
              className="px-3 py-2 border border-hairline bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              placeholder="Ed25519 public key (base64)"
              value={newAgent.public_key}
              onChange={(e) => setNewAgent({ ...newAgent, public_key: e.target.value })}
              className="px-3 py-2 border border-hairline bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createAgent} className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90">
              Create Agent
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-hairline text-sm text-muted-foreground hover:bg-surface">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-hairline bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {loading ? (
        <div className="border border-hairline bg-surface p-8 text-center text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-hairline bg-surface p-16 text-center">
          <p className="text-muted-foreground">You haven&apos;t registered any agents yet. Create your first agent to get a public key and start issuing tokens.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-hairline bg-hairline">
          <table className="w-full">
            <thead>
              <tr className="bg-surface">
                <th className="text-left px-4 py-3 text-xs eyebrow">Name</th>
                <th className="text-left px-4 py-3 text-xs eyebrow">Status</th>
                <th className="text-left px-4 py-3 text-xs eyebrow">Approval Mode</th>
                <th className="text-left px-4 py-3 text-xs eyebrow">Created</th>
                <th className="text-right px-4 py-3 text-xs eyebrow">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((agent) => (
                <tr key={agent.id} className="bg-background rule-x">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/agents/${agent.id}`} className="text-sm font-medium hover:underline">{agent.name}</Link>
                    <div className="text-xs text-muted-foreground font-mono">{agent.id?.substring(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 ${agent.status === 'active' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{agent.approval_mode_override || 'Org default'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(agent.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 hover:bg-surface transition-colors" title="Rotate key">
                        <RotateCw className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {agent.status === 'active' && (
                        <button onClick={() => revokeAgent(agent.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Revoke">
                          <Ban className="w-4 h-4 text-destructive" />
                        </button>
                      )}
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
