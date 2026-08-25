'use client';

import { useEffect, useState } from 'react';
import { Bot, Shield, Activity, CheckSquare, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { StatsSkeleton } from '@/components/loading-skeleton';
import { agentsApi, auditApi, approvalsApi } from '@/lib/api';

interface Stats {
  totalAgents: number;
  activeGrants: number;
  auditEvents: number;
  pendingApprovals: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ totalAgents: 0, activeGrants: 0, auditEvents: 0, pendingApprovals: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId] = useState('00000000-0000-0000-0000-000000000001'); // Default org

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [agentsRes, auditRes, approvalsRes] = await Promise.all([
        agentsApi.list(orgId),
        auditApi.list(orgId, { limit: 10 }),
        approvalsApi.list(orgId, 'pending'),
      ]);

      setStats({
        totalAgents: Array.isArray(agentsRes.data) ? agentsRes.data.length : 0,
        activeGrants: 0, // Will be populated from agents
        auditEvents: auditRes.data?.total || 0,
        pendingApprovals: Array.isArray(approvalsRes.data) ? approvalsRes.data.length : 0,
      });

      setRecentActivity(Array.isArray(auditRes.data?.data) ? auditRes.data.data.slice(0, 5) : []);
      setPendingApprovals(Array.isArray(approvalsRes.data) ? approvalsRes.data.slice(0, 5) : []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'Total agents', value: stats.totalAgents, change: '+2', trend: 'up' as const, icon: Bot },
    { label: 'Active grants', value: stats.activeGrants, change: '+5', trend: 'up' as const, icon: Shield },
    { label: 'Audit events', value: stats.auditEvents, change: '+128', trend: 'up' as const, icon: Activity },
    { label: 'Pending approvals', value: stats.pendingApprovals, change: '-1', trend: 'down' as const, icon: CheckSquare },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Overview</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Monitor your agent activity and permissions at a glance.
        </p>
      </div>

      {loading ? (
        <StatsSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</span>
                  <stat.icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-semibold text-gray-900 dark:text-white">{stat.value}</span>
                  <span className={`text-xs flex items-center gap-0.5 mb-1 ${stat.trend === 'up' ? 'text-green-600' : 'text-gray-500'}`}>
                    {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-gray-900 dark:text-white">Recent activity</h2>
                <a href="/dashboard/activity" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">View all</a>
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">No activity yet. Register an agent to get started.</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          entry.result === 'allowed' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          entry.result === 'denied' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {entry.result}
                        </span>
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{entry.action}</span>
                          <span className="text-sm text-gray-400 dark:text-gray-500 ml-2">{entry.resource}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 dark:text-gray-400">{entry.actor_id?.substring(0, 8)}...</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-gray-900 dark:text-white">Pending approvals</h2>
                <a href="/dashboard/approvals" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">View all</a>
              </div>
              {pendingApprovals.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">No pending approvals.</p>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.map((approval: any) => (
                    <div key={approval.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{approval.action}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{approval.resource}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 dark:text-gray-400">{approval.agent?.name || approval.agent_id?.substring(0, 8)}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(approval.requested_at).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
