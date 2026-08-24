'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { grantsApi, agentsApi } from '@/lib/api';

interface Grant {
  id: string;
  agent_id: string;
  resource_type: string;
  resource_pattern: string;
  allowed_actions: string[];
  status: string;
  expires_at: string | null;
  usage_cap: number | null;
  usage_count: number;
}

interface Agent {
  id: string;
  name: string;
}

export default function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGrant, setNewGrant] = useState({
    resource_type: '',
    resource_pattern: '',
    allowed_actions: [] as string[],
    expires_at: '',
    usage_cap: '',
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedAgent) fetchGrants(selectedAgent);
  }, [selectedAgent]);

  const fetchAgents = async () => {
    const orgId = 'demo-org-id';
    const { data } = await agentsApi.list(orgId);
    if (data) {
      setAgents(data);
      if (data.length > 0) setSelectedAgent(data[0].id);
    }
    setLoading(false);
  };

  const fetchGrants = async (agentId: string) => {
    const { data } = await grantsApi.list(agentId);
    if (data) setGrants(data);
  };

  const handleCreateGrant = async () => {
    const userId = 'demo-user-id';
    const { data } = await grantsApi.create({
      agent_id: selectedAgent,
      resource_type: newGrant.resource_type,
      resource_pattern: newGrant.resource_pattern,
      allowed_actions: newGrant.allowed_actions,
      created_by_user_id: userId,
      expires_at: newGrant.expires_at || undefined,
      usage_cap: newGrant.usage_cap ? parseInt(newGrant.usage_cap) : undefined,
    });
    if (data) {
      fetchGrants(selectedAgent);
      setShowCreateModal(false);
      setNewGrant({ resource_type: '', resource_pattern: '', allowed_actions: [], expires_at: '', usage_cap: '' });
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    if (!confirm('Revoke this grant? The agent will lose access immediately.')) return;
    const { data } = await grantsApi.revoke(grantId);
    if (data) fetchGrants(selectedAgent);
  };

  const toggleAction = (action: string) => {
    setNewGrant({
      ...newGrant,
      allowed_actions: newGrant.allowed_actions.includes(action)
        ? newGrant.allowed_actions.filter((a) => a !== action)
        : [...newGrant.allowed_actions, action],
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Grants</h1>
          <p className="text-sm text-gray-500 mt-1">
            Control what each agent can access and for how long.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedAgent}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add grant
        </button>
      </div>

      {/* Agent selector */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-gray-500">Agent:</label>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Resource</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Usage</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td>
              </tr>
            ) : grants.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Shield className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900 mb-1">No grants</p>
                  <p className="text-sm text-gray-500">Add a grant to give this agent permissions.</p>
                </td>
              </tr>
            ) : (
              grants.map((grant) => (
                <tr key={grant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{grant.resource_type}</div>
                    <div className="text-xs text-gray-400 font-mono">{grant.resource_pattern}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {grant.allowed_actions.map((action) => (
                        <span key={action} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                          {action}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {grant.usage_count}
                    {grant.usage_cap ? ` / ${grant.usage_cap}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                        grant.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : grant.status === 'expired'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {grant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {grant.status === 'active' && (
                      <button
                        onClick={() => handleRevokeGrant(grant.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Revoke grant"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold">Add grant</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Resource type</label>
                  <input
                    type="text"
                    value={newGrant.resource_type}
                    onChange={(e) => setNewGrant({ ...newGrant, resource_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="e.g. database"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Resource pattern</label>
                  <input
                    type="text"
                    value={newGrant.resource_pattern}
                    onChange={(e) => setNewGrant({ ...newGrant, resource_pattern: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="e.g. users/*"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Allowed actions</label>
                <div className="flex gap-2">
                  {['read', 'write', 'delete', 'execute'].map((action) => (
                    <button
                      key={action}
                      onClick={() => toggleAction(action)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        newGrant.allowed_actions.includes(action)
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Expires at</label>
                  <input
                    type="datetime-local"
                    value={newGrant.expires_at}
                    onChange={(e) => setNewGrant({ ...newGrant, expires_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Usage cap</label>
                  <input
                    type="number"
                    value={newGrant.usage_cap}
                    onChange={(e) => setNewGrant({ ...newGrant, usage_cap: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Unlimited"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGrant}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Add grant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Shield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
