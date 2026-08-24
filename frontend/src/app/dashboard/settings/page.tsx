'use client';

import { useState } from 'react';
import { Save, Check } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    default_approval_mode: 'autonomous',
    token_ttl: '10',
    ip_allowlist: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure organization-level policies for your agents.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-medium mb-4">Approval policy</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default mode</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="approval_mode" value="autonomous"
                    checked={settings.default_approval_mode === 'autonomous'}
                    onChange={(e) => setSettings({ ...settings, default_approval_mode: e.target.value })}
                    className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-medium">Autonomous</div>
                    <div className="text-xs text-gray-500">Agents act without approval</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="approval_mode" value="human_in_the_loop"
                    checked={settings.default_approval_mode === 'human_in_the_loop'}
                    onChange={(e) => setSettings({ ...settings, default_approval_mode: e.target.value })}
                    className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-medium">Human-in-the-loop</div>
                    <div className="text-xs text-gray-500">Requires human approval</div>
                  </div>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Token TTL (minutes)</label>
              <input type="number" value={settings.token_ttl}
                onChange={(e) => setSettings({ ...settings, token_ttl: e.target.value })}
                min="5" max="15"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
              <p className="text-xs text-gray-400 mt-1">How long agent tokens remain valid (5–15 min)</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-medium mb-4">Security</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">IP allowlist</label>
            <textarea value={settings.ip_allowlist}
              onChange={(e) => setSettings({ ...settings, ip_allowlist: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              rows={3} placeholder="192.168.1.0/24&#10;10.0.0.0/8" />
            <p className="text-xs text-gray-400 mt-1">Restrict dashboard access to specific IP ranges</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50">
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
