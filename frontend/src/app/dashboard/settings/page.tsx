'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [mode, setMode] = useState('autonomous');
  const [orgName, setOrgName] = useState('My Organization');
  const [tokenTTL, setTokenTTL] = useState(10);
  const [saved, setSaved] = useState(false);
  const [showDanger, setShowDanger] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl">Settings</h1>
      </div>

      <div className="space-y-px overflow-hidden border border-hairline bg-hairline max-w-3xl">
        {/* Organization */}
        <div className="bg-background p-6">
          <div className="eyebrow mb-4">Organization</div>
          <div>
            <label className="block text-sm mb-1.5">Organization name</label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 border border-hairline bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Default Approval Policy */}
        <div className="bg-background p-6">
          <div className="eyebrow mb-4">Default Approval Policy</div>
          <p className="text-sm text-muted-foreground mb-4">Set the default approval mode for agents in this organization.</p>
          <div className="space-y-2">
            {[
              { value: 'autonomous', label: 'Autonomous', desc: 'Agents can execute actions without human approval' },
              { value: 'human_in_the_loop', label: 'Human-in-the-loop', desc: 'Critical actions require human approval before execution' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                  mode === opt.value
                    ? 'border-foreground bg-surface'
                    : 'border-hairline hover:border-foreground/40'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Token Settings */}
        <div className="bg-background p-6">
          <div className="eyebrow mb-4">Token Settings</div>
          <div>
            <label className="block text-sm mb-1.5">Token TTL (minutes)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={5}
                max={60}
                value={tokenTTL}
                onChange={(e) => setTokenTTL(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono w-12 text-right">{tokenTTL}m</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">How long issued JWT tokens remain valid. Shorter = more secure.</p>
          </div>
        </div>

        {/* Security */}
        <div className="bg-background p-6">
          <div className="eyebrow mb-4">Security</div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5">IP Allowlist</label>
              <textarea
                placeholder="Enter IPs, one per line (leave empty for no restriction)"
                rows={3}
                className="w-full px-3 py-2 border border-hairline bg-surface text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-background p-6">
          <div className="eyebrow mb-4 text-destructive">Danger Zone</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-destructive/30">
              <div>
                <div className="text-sm font-medium">Revoke all agent access</div>
                <div className="text-xs text-muted-foreground">Immediately revoke all active tokens and keys for all agents.</div>
              </div>
              <button
                onClick={() => setShowDanger(!showDanger)}
                className="px-3 py-1.5 border border-destructive text-destructive text-sm hover:bg-destructive/5 transition-colors"
              >
                Revoke All
              </button>
            </div>
            {showDanger && (
              <div className="p-3 border border-destructive/30 bg-destructive/5">
                <p className="text-sm text-muted-foreground mb-2">Type <strong>{orgName}</strong> to confirm:</p>
                <div className="flex gap-2">
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={orgName}
                    className="flex-1 px-3 py-2 border border-hairline bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    disabled={confirmText !== orgName}
                    className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 max-w-3xl">
        <button
          onClick={handleSave}
          className={`px-6 py-2.5 text-sm font-medium transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-primary text-primary-foreground hover:opacity-90'
          }`}
        >
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
