'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { agentsApi, grantsApi } from '@/lib/api';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Step 1: Agent
  const [agentName, setAgentName] = useState('');
  const [createdAgent, setCreatedAgent] = useState<any>(null);

  // Step 2: Grant
  const [resourceType, setResourceType] = useState('database');
  const [resourcePattern, setResourcePattern] = useState('users/*');
  const [actions, setActions] = useState<string[]>(['read']);

  // Step 3: Approval mode
  const [approvalMode, setApprovalMode] = useState<'autonomous' | 'human_in_the_loop'>('human_in_the_loop');

  // Step 4: Done
  const [sdkCode, setSdkCode] = useState('');

  async function handleCreateAgent() {
    if (!agentName) return;
    setLoading(true);
    try {
      // Generate a demo Ed25519 public key for the onboarding agent
      const demoPubKey = `demo-key-${crypto.randomUUID().substring(0, 12)}`;
      const res = await agentsApi.create({ org_id: ORG_ID, name: agentName, public_key: demoPubKey });
      setCreatedAgent(res.data);
      setStep(2);
    } catch (err) {
      console.error('Failed to create agent:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGrant() {
    if (!createdAgent) return;
    setLoading(true);
    try {
      await grantsApi.create({
        agent_id: createdAgent.agent_id,
        resource_type: resourceType,
        resource_pattern: resourcePattern,
        allowed_actions: actions,
        created_by_user_id: '00000000-0000-0000-0000-000000000001',
      });
      setStep(3);
    } catch (err) {
      console.error('Failed to create grant:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleComplete() {
    const code = `import { AgentAuthClient } from 'agentauth-sdk';\n\nconst client = new AgentAuthClient(\n  '${createdAgent?.agent_id || 'your-agent-id'}',\n  'your-private-key',\n  window.location.origin\n);\n\n// Authenticate\nconst token = await client.getToken();\n\n// Check permissions\nconst result = await client.checkPermission(\n  '${resourceType}',\n  '${resourcePattern.replace('*', '123')}',\n  'read'\n);\n\nconsole.log(result.allowed ? 'Access granted' : 'Denied:', result.reason);`;
    setSdkCode(code);
    setStep(4);
  }

  function handleFinish() {
    localStorage.setItem('agentauth_onboarded', 'true');
    onComplete();
  }

  function copyCode() {
    navigator.clipboard.writeText(sdkCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const steps = [
    { n: 1, label: 'Create Agent' },
    { n: 2, label: 'Set Grant' },
    { n: 3, label: 'Approval Mode' },
    { n: 4, label: 'You\'re Set' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 text-sm ${
                step >= s.n
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface text-muted-foreground'
              }`}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span className={`text-xs ${step === s.n ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && <div className="w-8 h-px bg-hairline" />}
            </div>
          ))}
        </div>

        {/* Step 1: Create Agent */}
        {step === 1 && (
          <div className="border border-hairline bg-background p-8">
            <div className="eyebrow mb-2">Step 1 of 4</div>
            <h2 className="text-2xl mb-2">Create your first agent</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Every AI agent needs a persistent identity. Give it a name and we&apos;ll register it for you.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5">Agent name</label>
                <input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. research-agent, sdr-bot, code-assistant"
                  className="w-full px-3 py-2 border border-hairline bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateAgent()}
                />
              </div>
            </div>
            <div className="flex justify-between items-center mt-8">
              <button onClick={handleFinish} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Skip setup
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={!agentName || loading}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Creating…' : 'Create Agent'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Set Grant */}
        {step === 2 && (
          <div className="border border-hairline bg-background p-8">
            <div className="eyebrow mb-2">Step 2 of 4</div>
            <h2 className="text-2xl mb-2">Set a grant</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Grants define exactly what an agent can access. Nothing is allowed by default — you decide.
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5">Resource type</label>
                  <input
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value)}
                    placeholder="e.g. database, calendar, repo"
                    className="w-full px-3 py-2 border border-hairline bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">Resource pattern</label>
                  <input
                    value={resourcePattern}
                    onChange={(e) => setResourcePattern(e.target.value)}
                    placeholder="e.g. users/*, orders/*"
                    className="w-full px-3 py-2 border border-hairline bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1.5">Allowed actions</label>
                <div className="flex gap-2">
                  {['read', 'write', 'delete', 'execute'].map((action) => (
                    <button
                      key={action}
                      onClick={() => setActions(actions.includes(action) ? actions.filter((a) => a !== action) : [...actions, action])}
                      className={`px-3 py-1.5 text-sm transition-colors ${
                        actions.includes(action)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center mt-8">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleCreateGrant}
                disabled={loading || actions.length === 0}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Creating…' : 'Set Grant'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Approval Mode */}
        {step === 3 && (
          <div className="border border-hairline bg-background p-8">
            <div className="eyebrow mb-2">Step 3 of 4</div>
            <h2 className="text-2xl mb-2">Choose your approval mode</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Decide whether agents run autonomously or wait for human approval before acting.
            </p>
            <div className="space-y-3">
              {[
                {
                  value: 'autonomous' as const,
                  label: 'Autonomous',
                  desc: 'Agents execute actions without human approval. Use for trusted, low-risk workflows.',
                  icon: '⚡',
                },
                {
                  value: 'human_in_the_loop' as const,
                  label: 'Human-in-the-loop',
                  desc: 'Critical actions require human approval before execution. Recommended for production.',
                  icon: '🛡️',
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setApprovalMode(opt.value)}
                  className={`w-full text-left flex items-start gap-4 p-4 border transition-colors ${
                    approvalMode === opt.value
                      ? 'border-foreground bg-surface'
                      : 'border-hairline hover:border-foreground/40'
                  }`}
                >
                  <span className="text-2xl mt-0.5">{opt.icon}</span>
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                  </div>
                  {approvalMode === opt.value && (
                    <div className="ml-auto mt-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                      ✓
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-between items-center mt-8">
              <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: You're Set */}
        {step === 4 && (
          <div className="border border-hairline bg-background p-8">
            <div className="eyebrow mb-2">Step 4 of 4</div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-5 h-5 text-foreground" />
              <h2 className="text-2xl">You&apos;re set</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Your agent <strong>{agentName}</strong> is registered with a <strong>{approvalMode === 'human_in_the_loop' ? 'human-in-the-loop' : 'autonomous'}</strong> approval policy and a grant for <strong>{resourceType}:{resourcePattern}</strong>.
            </p>

            <div className="mb-6">
              <div className="eyebrow mb-2">Agent Details</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Agent ID:</span>
                  <div className="font-mono text-xs mt-0.5 break-all">{createdAgent?.agent_id || 'Not created'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Approval Mode:</span>
                  <div className="mt-0.5">{approvalMode === 'human_in_the_loop' ? 'Human-in-the-loop' : 'Autonomous'}</div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="eyebrow mb-2">Quick Start Code</div>
              <div className="relative">
                <div className="flex items-center justify-between border border-hairline bg-surface px-4 py-2">
                  <span className="text-xs text-muted-foreground font-mono">python</span>
                  <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="border border-t-0 border-hairline bg-surface p-4 overflow-x-auto">
                  <code className="text-sm text-foreground font-mono whitespace-pre">{sdkCode}</code>
                </pre>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
