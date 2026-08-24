'use client';

import { useEffect, useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { approvalsApi } from '@/lib/api';

interface Approval {
  id: string;
  agent_id: string;
  action: string;
  resource: string;
  status: string;
  requested_at: string;
  context: any;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');

  useEffect(() => {
    fetchApprovals();
  }, [filter]);

  const fetchApprovals = async () => {
    const orgId = 'demo-org-id';
    const { data } = await approvalsApi.list(orgId, filter);
    if (data) setApprovals(data);
    setLoading(false);
  };

  const handleDecision = async (approvalId: string, decision: 'approve' | 'deny') => {
    const userId = 'demo-user-id';
    const { data } = await approvalsApi.decide(approvalId, decision, userId);
    if (data) fetchApprovals();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and decide on pending agent actions.
          </p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {['pending', 'approved', 'denied'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
                filter === status
                  ? 'bg-white text-gray-900 font-medium shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : approvals.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900 mb-1">No {filter} approvals</p>
            <p className="text-sm text-gray-500">
              {filter === 'pending'
                ? 'All caught up. New approvals will appear here.'
                : `No ${filter} approvals to show.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {approvals.map((approval) => (
              <div key={approval.id} className="px-4 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          approval.status === 'pending'
                            ? 'bg-yellow-50 text-yellow-700'
                            : approval.status === 'approved'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {approval.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(approval.requested_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-sm font-medium">{approval.action}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Resource: <span className="font-mono">{approval.resource}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">Agent: {approval.agent_id}</div>
                  </div>

                  {approval.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDecision(approval.id, 'approve')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecision(approval.id, 'deny')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Deny
                      </button>
                    </div>
                  )}
                </div>

                {approval.context && (
                  <pre className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 font-mono overflow-x-auto">
                    {JSON.stringify(approval.context, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
