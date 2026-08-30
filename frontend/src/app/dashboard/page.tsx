'use client';

import { useEffect, useState } from 'react';
import { agentsApi, auditApi, approvalsApi } from '@/lib/api';
import Link from 'next/link';

interface Stats {
  totalAgents: number;
  pendingApprovals: number;
  actionsToday: number;
  auditEventsToday: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ totalAgents: 0, pendingApprovals: 0, actionsToday: 0, auditEventsToday: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId] = useState('00000000-0000-0000-0000-000000000001');

  useEffect(() => { loadDashboard(); }, []);

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
        pendingApprovals: Array.isArray(approvalsRes.data) ? approvalsRes.data.length : 0,
        actionsToday: auditRes.data?.total || 0,
        auditEventsToday: auditRes.data?.total || 0,
      });
      setRecentActivity(Array.isArray(auditRes.data?.data) ? auditRes.data.data.slice(0, 5) : []);
      setPendingApprovals(Array.isArray(approvalsRes.data) ? approvalsRes.data.slice(0, 3) : []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  const summaryCards = [
    { label: 'Active Agents', value: stats.totalAgents },
    { label: 'Pending Approvals', value: stats.pendingApprovals, link: '/dashboard/approvals' },
    { label: 'Actions Today', value: stats.actionsToday },
    { label: 'Audit Events Today', value: stats.auditEventsToday },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl">Overview</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden border border-hairline bg-hairline mb-8">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-background p-5">
            <div className="eyebrow">{card.label}</div>
            <div className="mt-4 text-3xl">{card.value}</div>
            {card.link && (
              <Link href={card.link} className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Review →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Live Activity Feed + Pending Approvals */}
      <div className="grid gap-px overflow-hidden border border-hairline bg-hairline md:grid-cols-2">
        <div className="bg-background p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg">Live Activity Feed</h2>
            <Link href="/dashboard/activity" className="text-sm text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8">
              No activity yet. Once your agents start making calls, you&apos;ll see them here in real time.
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between py-2 rule-x last:border-t-0">
                  <div className="flex items-center gap-3">
                    <span className={`eyebrow ${entry.result === 'allowed' ? 'text-green-600' : entry.result === 'denied' ? 'text-red-600' : ''}`}>
                      {entry.result}
                    </span>
                    <div>
                      <span className="text-sm font-medium">{entry.action}</span>
                      <span className="text-sm text-muted-foreground ml-2">{entry.resource}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-background p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg">Pending Approvals</h2>
            <Link href="/dashboard/approvals" className="text-sm text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8">
              Nothing waiting on you right now.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((approval: any) => (
                <div key={approval.id} className="flex items-center justify-between py-2 rule-x last:border-t-0">
                  <div>
                    <div className="text-sm font-medium">{approval.action}</div>
                    <div className="text-xs text-muted-foreground">{approval.resource}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{approval.agent?.name || 'Agent'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
