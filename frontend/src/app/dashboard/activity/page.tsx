'use client';

import { useEffect, useState } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { auditApi } from '@/lib/api';

interface AuditEntry {
  id: string;
  actor_type: string;
  actor_id: string;
  action: string;
  resource: string;
  result: string;
  timestamp: string;
  hash: string;
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ agent_id: '', from: '', to: '', result: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    const orgId = 'demo-org-id';
    const { data } = await auditApi.list(orgId, { ...filters, page, limit: 20 });
    if (data) {
      setLogs(data.data);
      setTotalPages(data.pages);
    }
    setLoading(false);
  };

  const handleVerifyChain = async () => {
    const orgId = 'demo-org-id';
    const { data } = await auditApi.verifyChain(orgId);
    if (data) {
      alert(data.valid ? `Chain valid. Checked ${data.checked_entries} entries.` : `Chain broken at: ${data.broken_at_entry_id}`);
    }
  };

  const resultStyles: Record<string, string> = {
    allowed: 'bg-green-50 text-green-700',
    denied: 'bg-red-50 text-red-700',
    pending: 'bg-yellow-50 text-yellow-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Audit log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tamper-evident record of all agent activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyChain}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Verify chain
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by agent ID..."
          value={filters.agent_id}
          onChange={(e) => setFilters({ ...filters, agent_id: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <input
          type="datetime-local"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <input
          type="datetime-local"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <select
          value={filters.result}
          onChange={(e) => setFilters({ ...filters, result: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        >
          <option value="">All results</option>
          <option value="allowed">Allowed</option>
          <option value="denied">Denied</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Log table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Resource</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Result</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <p className="text-sm text-gray-500">No audit entries match your filters.</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {log.actor_type}
                    </span>
                    <span className="text-xs text-gray-400 font-mono ml-2">
                      {log.actor_id.substring(0, 8)}...
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{log.action}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{log.resource}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${resultStyles[log.result] || 'bg-gray-100 text-gray-600'}`}>
                      {log.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                    {log.hash.substring(0, 12)}...
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
