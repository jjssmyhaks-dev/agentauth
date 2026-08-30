'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { TableSkeleton } from '@/components/loading-skeleton';
import { approvalsApi } from '@/lib/api';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId] = useState('00000000-0000-0000-0000-000000000001');
  const [filter, setFilter] = useState('pending');

  useEffect(() => { loadApprovals(); }, [filter]);

  async function loadApprovals() {
    setLoading(true);
    const res = await approvalsApi.list(orgId, filter);
    setApprovals(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }

  async function decide(id: string, decision: 'approve' | 'deny') {
    await approvalsApi.decide(id, decision, '00000000-0000-0000-0000-000000000001');
    loadApprovals();
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl">Approvals</h1>
        <p >Review and decide pending agent actions.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'denied'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton /> : approvals.length === 0 ? (
        <div className="border border-hairline bg-surface p-16 text-center">
          <p className="text-muted-foreground">No {filter} approvals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className="bg-background border border-hairline p-5 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{a.action}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{a.resource}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Agent: {a.agent?.name || a.agent_id?.substring(0, 8)} · {new Date(a.requested_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  a.status === 'pending' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  a.status === 'approved' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>{a.status}</span>
                {a.status === 'pending' && (
                  <>
                    <button onClick={() => decide(a.id, 'approve')} className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40" title="Approve">
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </button>
                    <button onClick={() => decide(a.id, 'deny')} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40" title="Deny">
                      <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
