'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [mode, setMode] = useState('autonomous');
  const [orgName, setOrgName] = useState('My Organization');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure your organization and approval policies.</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h2 className="font-medium text-gray-900 dark:text-white mb-4">Organization</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Organization name</label>
              <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h2 className="font-medium text-gray-900 dark:text-white mb-4">Approval Policy</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Set the default approval mode for agents in this organization.</p>
          <div className="space-y-3">
            {[
              { value: 'autonomous', label: 'Autonomous', desc: 'Agents can execute actions without human approval' },
              { value: 'human_in_the_loop', label: 'Human-in-the-loop', desc: 'Critical actions require human approval before execution' },
            ].map((opt) => (
              <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                mode === opt.value ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-700/50' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
                <input type="radio" name="mode" value={opt.value} checked={mode === opt.value} onChange={() => setMode(opt.value)} className="mt-0.5" />
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{opt.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h2 className="font-medium text-gray-900 dark:text-white mb-4">API Keys</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Manage API keys for developer access to the AgentAuth API.</p>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Create API key
          </button>
        </div>

        <button onClick={handleSave} className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          saved ? 'bg-green-600 text-white' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
        }`}>
          {saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
