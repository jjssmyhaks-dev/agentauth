'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { agentsApi, grantsApi, auditApi, analyticsApi } from '@/lib/api';
import { ArrowLeft, RotateCw, Ban, Copy, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

const orgId = '00000000-0000-0000-0000-000000000001';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<any>(null);
  const [grants, setGrants] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any>(null);
  const [tab, setTab] = useState<'overview' | 'grants' | 'activity'>('overview');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    loadData();
  }, [agentId]);

  async function loadData() {
    setLoading(true);
    try {
      const [agentRes, grantsRes, activityRes, feedbackRes] = await Promise.all([
        agentsApi.get(agentId),
        grantsApi.list(agentId),
        auditApi.list(orgId, { agent_id: agentId, limit: 20 }),
        analyticsApi.feedback(orgId, agentId),
      ]);
      if (agentRes.data) setAgent(agentRes.data);
      if (grantsRes.data) setGrants(Array.isArray(grantsRes.data) ? grantsRes.data : []);
      if (activityRes.data?.data) setActivity(activityRes.data.data);
      if (feedbackRes.data) setFeedback(feedbackRes.data);
    } catch (err) {
      console.error('Failed to load agent:', err);
    } finally {
      setLoading(false);
    }
  }

  async function revokeAgent() {
    if (!confirm('Revoke this agent? This cannot be undone.')) return;
    await agentsApi.revoke(agentId);
    loadData();
  }

  const copyPublicKey = () => {
    if (agent?.public_key) {
      navigator.clipboard.writeText(agent.public_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="h-8 w-48 bg-surface animate-pulse" />
        <div className="h-32 bg-surface animate-pulse" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="animate-fade-in text-center py-16">
        <p className="text-muted-foreground">Agent not found.</p>
        <Link href="/dashboard/agents" className="text-sm underline mt-4 inline-block">← Back to agents</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-surface transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl">{agent.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 ${agent.status === 'active' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              {agent.status}
            </span>
            <span className="text-xs text-muted-foreground font-mono">{agent.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-hairline text-sm hover:bg-surface transition-colors">
            <RotateCw className="w-3.5 h-3.5" /> Rotate Key
          </button>
          {agent.status === 'active' && (
            <button onClick={revokeAgent} className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 dark:border-red-900/30 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
              <Ban className="w-3.5 h-3.5" /> Revoke
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-hairline">
        {(['overview', 'grants', 'activity'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors ${tab === t ? 'border-b-2 border-foreground text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Agent Info */}
          <div className="border border-hairline bg-background p-6 space-y-4">
            <h3 className="text-lg">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(agent.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approval Mode</span>
                <span>{agent.approval_mode_override || 'Org default'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tier</span>
                <span>{agent.agent_tier || 'internal'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Active</span>
                <span>{agent.last_active_at ? new Date(agent.last_active_at).toLocaleString() : 'Never'}</span>
              </div>
            </div>

            {/* Public Key */}
            <div>
              <div className="text-xs eyebrow mb-2">Public Key</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-surface p-2 rounded break-all font-mono">
                  {agent.public_key?.substring(0, 60)}…
                </code>
                <button onClick={copyPublicKey} className="p-1.5 hover:bg-surface transition-colors shrink-0">
                  {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Stats + Feedback */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-px overflow-hidden border border-hairline bg-hairline">
              <div className="bg-background p-4">
                <div className="text-xs eyebrow">Tokens</div>
                <div className="mt-2 text-2xl tabular-nums">{(agent.token_count || 0).toLocaleString()}</div>
              </div>
              <div className="bg-background p-4">
                <div className="text-xs eyebrow">Actions</div>
                <div className="mt-2 text-2xl tabular-nums">{(agent.total_actions || 0).toLocaleString()}</div>
              </div>
              <div className="bg-background p-4">
                <div className="text-xs eyebrow">Approvals</div>
                <div className="mt-2 text-2xl tabular-nums">{agent.approval_count || 0}</div>
              </div>
              <div className="bg-background p-4">
                <div className="text-xs eyebrow">Denials</div>
                <div className="mt-2 text-2xl tabular-nums">{agent.denial_count || 0}</div>
              </div>
            </div>

            {/* AI Feedback */}
            {feedback && (
              <div className="border border-hairline bg-background p-6">
                <h3 className="text-lg mb-4">AI Feedback</h3>
                <div className="space-y-3">
                  {feedback.warnings?.map((w: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-900/10 p-2.5 border border-red-200 dark:border-red-900/30">
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                  {feedback.feedback?.map((f: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm bg-green-50 dark:bg-green-900/10 p-2.5 border border-green-200 dark:border-green-900/30">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                  {feedback.suggestions?.map((s: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'grants' && (
        <div className="border border-hairline bg-background">
          {grants.length === 0 ? (
            <div className="p-16 text-center text-sm text-muted-foreground">
              No grants configured. Grants define what this agent can access.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface">
                  <th className="text-left px-4 py-3 text-xs eyebrow">Resource</th>
                  <th className="text-left px-4 py-3 text-xs eyebrow">Actions</th>
                  <th className="text-left px-4 py-3 text-xs eyebrow">Expires</th>
                  <th className="text-left px-4 py-3 text-xs eyebrow">Status</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((g: any) => (
                  <tr key={g.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{g.resource_type}</div>
                      <div className="text-xs text-muted-foreground font-mono">{g.resource_pattern}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{g.allowed_actions?.join(', ')}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g.expires_at ? new Date(g.expires_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 ${g.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {g.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="border border-hairline bg-background">
          {activity.length === 0 ? (
            <div className="p-16 text-center text-sm text-muted-foreground">
              No activity yet. Audit events appear when this agent makes API calls.
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {activity.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 ${entry.result === 'allowed' ? 'bg-green-50 text-green-700' : entry.result === 'denied' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {entry.result}
                    </span>
                    <div>
                      <span className="text-sm font-medium">{entry.action}</span>
                      <span className="text-sm text-muted-foreground ml-2">{entry.resource}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
