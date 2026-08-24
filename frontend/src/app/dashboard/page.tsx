'use client';

import { useEffect, useState } from 'react';
import { Bot, Shield, Activity, CheckSquare, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Stats {
  totalAgents: number;
  activeGrants: number;
  auditEvents: number;
  pendingApprovals: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalAgents: 0,
    activeGrants: 0,
    auditEvents: 0,
    pendingApprovals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, fetch real stats from API
    setLoading(false);
  }, []);

  const statCards = [
    {
      label: 'Total agents',
      value: stats.totalAgents,
      change: '+2',
      trend: 'up',
      icon: Bot,
    },
    {
      label: 'Active grants',
      value: stats.activeGrants,
      change: '+5',
      trend: 'up',
      icon: Shield,
    },
    {
      label: 'Audit events (24h)',
      value: stats.auditEvents,
      change: '+128',
      trend: 'up',
      icon: Activity,
    },
    {
      label: 'Pending approvals',
      value: stats.pendingApprovals,
      change: '-1',
      trend: 'down',
      icon: CheckSquare,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor your agent activity and permissions at a glance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{stat.label}</span>
              <stat.icon className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-semibold">{stat.value}</span>
              <span
                className={`text-xs flex items-center gap-0.5 mb-1 ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-gray-500'
                }`}
              >
                {stat.trend === 'up' ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium">Recent activity</h2>
            <a
              href="/dashboard/activity"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              View all
            </a>
          </div>
          <div className="space-y-3">
            <ActivityRow
              agent="coding-agent-01"
              action="database.read"
              resource="users/*"
              result="allowed"
              time="2 min ago"
            />
            <ActivityRow
              agent="sdr-agent-02"
              action="email.send"
              resource="contacts/*"
              result="pending"
              time="5 min ago"
            />
            <ActivityRow
              agent="ops-agent-03"
              action="api.write"
              resource="/deploy"
              result="denied"
              time="12 min ago"
            />
            <ActivityRow
              agent="coding-agent-01"
              action="file.read"
              resource="config/*"
              result="allowed"
              time="18 min ago"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium">Pending approvals</h2>
            <a
              href="/dashboard/approvals"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              View all
            </a>
          </div>
          <div className="space-y-3">
            <ApprovalRow
              agent="sdr-agent-02"
              action="email.send"
              resource="contacts/42"
              time="5 min ago"
            />
            <ApprovalRow
              agent="ops-agent-03"
              action="deploy.execute"
              resource="staging"
              time="22 min ago"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  agent,
  action,
  resource,
  result,
  time,
}: {
  agent: string;
  action: string;
  resource: string;
  result: string;
  time: string;
}) {
  const resultStyles = {
    allowed: 'bg-green-50 text-green-700',
    denied: 'bg-red-50 text-red-700',
    pending: 'bg-yellow-50 text-yellow-700',
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${
            resultStyles[result as keyof typeof resultStyles] || 'bg-gray-100 text-gray-600'
          }`}
        >
          {result}
        </span>
        <div>
          <span className="text-sm font-medium">{action}</span>
          <span className="text-sm text-gray-400 ml-2">{resource}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-gray-500">{agent}</div>
        <div className="text-xs text-gray-400">{time}</div>
      </div>
    </div>
  );
}

function ApprovalRow({
  agent,
  action,
  resource,
  time,
}: {
  agent: string;
  action: string;
  resource: string;
  time: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div>
        <div className="text-sm font-medium">{action}</div>
        <div className="text-xs text-gray-400">{resource}</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-gray-500">{agent}</div>
        <div className="text-xs text-gray-400">{time}</div>
      </div>
    </div>
  );
}
