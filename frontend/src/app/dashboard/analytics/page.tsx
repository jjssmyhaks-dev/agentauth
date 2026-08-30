'use client';

import { useEffect, useState, useCallback } from 'react';
import { analyticsApi } from '@/lib/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Activity } from 'lucide-react';

const COLORS = ['#1a1a1a', '#6b7280', '#d1d5db', '#374151', '#9ca3af'];

interface Overview {
  total_agents: number;
  active_agents: number;
  total_tokens: number;
  total_actions: number;
  total_approvals: number;
  total_denials: number;
  success_rate: number;
  estimated_cost: number;
}

interface UsageRow {
  agent_id: string;
  agent_name: string;
  tokens: number;
  allowed: number;
  denied: number;
  pending: number;
  avg_latency: number;
  cost: number;
}

interface TimeSeriesPoint {
  hour: string;
  tokens: number;
  allowed: number;
  denied: number;
  pending: number;
  avg_latency: number;
}

interface AgentPerformance {
  agent_id: string;
  agent_name: string;
  status: string;
  token_count: number;
  total_actions: number;
  approval_count: number;
  denial_count: number;
  success_rate: number;
  avg_latency_ms: number;
  last_active_at: string | null;
  health: 'healthy' | 'warning' | 'critical';
}

interface AgentFeedback {
  agent_id: string;
  agent_name: string;
  health: string;
  metrics: {
    total_actions: number;
    success_rate: number;
    denial_rate: number;
    token_count: number;
    avg_latency_ms: number;
    token_trend_pct: number;
  };
  feedback: string[];
  suggestions: string[];
  warnings: string[];
}

const orgId = '00000000-0000-0000-0000-000000000001';

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [performance, setPerformance] = useState<AgentPerformance[]>([]);
  const [feedback, setFeedback] = useState<AgentFeedback | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, usageRes, tsRes, perfRes] = await Promise.all([
        analyticsApi.overview(orgId),
        analyticsApi.usage(orgId, days),
        analyticsApi.timeSeries(orgId, undefined, days),
        analyticsApi.performance(orgId),
      ]);
      if (ovRes.data) setOverview(ovRes.data);
      if (usageRes.data) setUsage(usageRes.data);
      if (tsRes.data) setTimeSeries(tsRes.data);
      if (perfRes.data) setPerformance(perfRes.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadFeedback = async (agentId: string) => {
    setSelectedAgent(agentId);
    setFeedbackLoading(true);
    try {
      const res = await analyticsApi.feedback(orgId, agentId);
      if (res.data) setFeedback(res.data);
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-32 bg-surface animate-pulse" />
            <div className="h-4 w-64 bg-surface animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden border border-hairline bg-hairline">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-background p-5">
              <div className="h-3 w-20 bg-surface animate-pulse" />
              <div className="h-8 w-16 bg-surface animate-pulse mt-3" />
            </div>
          ))}
        </div>
        <div className="grid gap-px overflow-hidden border border-hairline bg-hairline md:grid-cols-2">
          {[1,2].map(i => (
            <div key={i} className="bg-background p-6">
              <div className="h-5 w-40 bg-surface animate-pulse mb-4" />
              <div className="h-64 bg-surface animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track agent usage, performance, and get AI-powered feedback.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-hairline bg-background text-sm text-foreground"
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={loadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-hairline bg-background text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden border border-hairline bg-hairline">
        <SummaryCard label="Total Tokens" value={overview?.total_tokens || 0} icon={<Activity className="w-4 h-4" />} />
        <SummaryCard label="Success Rate" value={`${overview?.success_rate || 0}%`} icon={<CheckCircle className="w-4 h-4" />} />
        <SummaryCard label="Active Agents" value={`${overview?.active_agents || 0}/${overview?.total_agents || 0}`} icon={<Activity className="w-4 h-4" />} />
        <SummaryCard label="Est. Cost" value={`$${(overview?.estimated_cost || 0).toFixed(2)}`} icon={<TrendingUp className="w-4 h-4" />} />
      </div>

      {/* Charts Row */}
      <div className="grid gap-px overflow-hidden border border-hairline bg-hairline md:grid-cols-2">
        {/* Token Usage Over Time */}
        <div className="bg-background p-6">
          <h2 className="text-lg mb-4">Token Usage Over Time</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries.map((d) => ({ ...d, time: formatTime(d.hour) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="tokens" stroke="#1a1a1a" fill="#1a1a1a" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actions Breakdown */}
        <div className="bg-background p-6">
          <h2 className="text-lg mb-4">Actions Breakdown</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeries.map((d) => ({ ...d, time: formatTime(d.hour) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="allowed" name="Allowed" fill="#22c55e" stackId="a" />
                <Bar dataKey="denied" name="Denied" fill="#ef4444" stackId="a" />
                <Bar dataKey="pending" name="Pending" fill="#eab308" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Agent Performance Table + AI Feedback */}
      <div className="grid gap-px overflow-hidden border border-hairline bg-hairline lg:grid-cols-3">
        {/* Performance Table */}
        <div className="bg-background p-6 lg:col-span-2">
          <h2 className="text-lg mb-4">Agent Performance</h2>
          {performance.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No agent data yet. Performance metrics appear after agents start making API calls.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="text-left py-2 text-xs eyebrow">Agent</th>
                    <th className="text-left py-2 text-xs eyebrow">Health</th>
                    <th className="text-right py-2 text-xs eyebrow">Tokens</th>
                    <th className="text-right py-2 text-xs eyebrow">Actions</th>
                    <th className="text-right py-2 text-xs eyebrow">Success %</th>
                    <th className="text-right py-2 text-xs eyebrow">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((p) => (
                    <tr key={p.agent_id} className="border-b border-hairline last:border-0">
                      <td className="py-2.5">
                        <div className="font-medium">{p.agent_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{p.agent_id.substring(0, 8)}…</div>
                      </td>
                      <td className="py-2.5">
                        <HealthBadge health={p.health} />
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{p.token_count.toLocaleString()}</td>
                      <td className="py-2.5 text-right tabular-nums">{p.total_actions.toLocaleString()}</td>
                      <td className="py-2.5 text-right tabular-nums">{p.success_rate}%</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => loadFeedback(p.agent_id)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                        >
                          Analyze
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Feedback Panel */}
        <div className="bg-background p-6">
          <h2 className="text-lg mb-4">AI Feedback</h2>
          {feedbackLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Analyzing agent…</div>
          ) : !feedback ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Select an agent and click &quot;Analyze&quot; to get AI-powered feedback on performance and suggestions for improvement.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{feedback.agent_name}</span>
                <HealthBadge health={feedback.health as any} />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Tokens" value={feedback.metrics.token_count.toLocaleString()} />
                <MetricCard label="Success" value={`${feedback.metrics.success_rate.toFixed(1)}%`} />
                <MetricCard label="Denial Rate" value={`${feedback.metrics.denial_rate.toFixed(1)}%`} warning={feedback.metrics.denial_rate > 20} />
                <MetricCard label="Avg Latency" value={`${feedback.metrics.avg_latency_ms.toFixed(0)}ms`} />
              </div>

              {/* Token Trend */}
              <div className="flex items-center gap-2 text-sm">
                {feedback.metrics.token_trend_pct > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span>
                  Token usage {feedback.metrics.token_trend_pct > 0 ? 'up' : 'down'}{' '}
                  <span className="font-medium">{Math.abs(feedback.metrics.token_trend_pct).toFixed(0)}%</span>{' '}
                  vs prior 24h
                </span>
              </div>

              {/* Warnings */}
              {feedback.warnings.length > 0 && (
                <div className="space-y-2">
                  {feedback.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-900/10 p-2.5 border border-red-200 dark:border-red-900/30">
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback */}
              {feedback.feedback.length > 0 && (
                <div className="space-y-2">
                  {feedback.feedback.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm bg-green-50 dark:bg-green-900/10 p-2.5 border border-green-200 dark:border-green-900/30">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {feedback.suggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs eyebrow">Suggestions</div>
                  {feedback.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Token Usage by Agent (Bar Chart) */}
      {usage.length > 0 && (
        <div className="border border-hairline bg-background p-6">
          <h2 className="text-lg mb-4">Token Usage by Agent</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="agent_name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="tokens" fill="#1a1a1a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-background p-5">
      <div className="flex items-center gap-2 eyebrow">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-3xl tabular-nums">{value}</div>
    </div>
  );
}

function MetricCard({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className={`p-2.5 border ${warning ? 'border-red-200 dark:border-red-900/30' : 'border-hairline'}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg tabular-nums ${warning ? 'text-red-600' : ''}`}>{value}</div>
    </div>
  );
}

function HealthBadge({ health }: { health: 'healthy' | 'warning' | 'critical' }) {
  const styles = {
    healthy: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    critical: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 ${styles[health]}`}>
      {health}
    </span>
  );
}
