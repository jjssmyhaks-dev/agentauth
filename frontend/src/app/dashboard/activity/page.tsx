'use client';

import { useEffect, useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { TableSkeleton } from '@/components/loading-skeleton';
import { auditApi } from '@/lib/api';

export default function ActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [orgId] = useState('00000000-0000-0000-0000-000000000001');
  const [resultFilter, setResultFilter] = useState('');
  const [chainValid, setChainValid] = useState<boolean | null>(null);

  useEffect(() => { loadLogs(); }, [page, resultFilter]);

  async function loadLogs() {
    setLoading(true);
    const res = await auditApi.list(orgId, { page, limit: 20, result: resultFilter || undefined });
    const data = res.data;
    setLogs(Array.isArray(data?.data) ? data.data : []);
    setTotal(data?.total || 0);
    setLoading(false);
  }

  async function verifyChain() {
    const res = await auditApi.verifyChain(orgId);
    setChainValid(res.data?.valid ?? false);
  }

  const pages = Math.ceil(total / 20);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Audit Log</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tamper-evident log of all agent activity.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={verifyChain} className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <ShieldCheck className="w-4 h-4" />
            Verify chain
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {chainValid !== null && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${chainValid ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          Chain integrity: {chainValid ? '✅ Valid — all entries verified' : '❌ Broken — tampering detected'}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {['', 'allowed', 'denied', 'pending'].map((f) => (
          <button key={f} onClick={() => { setResultFilter(f); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              resultFilter === f ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}>
            {f || 'All'}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton /> : logs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400">No audit entries yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Time</th>
                  <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Actor</th>
                  <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Action</th>
                  <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Resource</th>
                  <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Result</th>
                  <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Hash</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="p-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-3"><span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{log.actor_type}</span> <span className="text-xs text-gray-400 ml-1">{log.actor_id?.substring(0, 8)}...</span></td>
                    <td className="p-3 font-medium text-gray-900 dark:text-white">{log.action}</td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">{log.resource}</td>
                    <td className="p-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        log.result === 'allowed' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        log.result === 'denied' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>{log.result}</span>
                    </td>
                    <td className="p-3 text-xs text-gray-400 dark:text-gray-500 font-mono">{log.hash?.substring(0, 12)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">{total} total entries</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50">Prev</button>
                <span className="px-2 py-1 text-xs text-gray-500">{page}/{pages}</span>
                <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page === pages} className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
