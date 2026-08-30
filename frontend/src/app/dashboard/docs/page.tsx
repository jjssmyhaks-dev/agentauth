'use client';

import { useState } from 'react';
import { Code, Copy, Check, ExternalLink } from 'lucide-react';

const codeExamples = {
  typescript: {
    install: 'npm install agentauth-sdk',
    setup: `import { AgentAuthClient } from 'agentauth-sdk';\n\nconst client = new AgentAuthClient(\n  'your-agent-id',\n  'your-private-key',\n  'https://api.agentauth.com'\n);`,
    getToken: `// Get a signed JWT token (handles challenge + signing automatically)\nconst token = await client.getToken();\nconsole.log(token); // eyJhbGciOiJS...`,
    checkPermission: `// Check if the agent has permission\nconst result = await client.checkPermission(\n  'database',\n  'users-table',\n  'read'\n);\n\nif (result.allowed) {\n  console.log('Access granted via grant:', result.matched_grant_id);\n} else {\n  console.log('Denied:', result.reason);\n}`,
    submitAction: `// Submit an action (handles approval flow automatically)\ntry {\n  const result = await client.submitAction(\n    'database',\n    'users-table',\n    'delete',\n    { user_id: '123' }\n  );\n  console.log('Action executed:', result);\n} catch (error) {\n  if (error.name === 'PendingApprovalTimeoutError') {\n    console.log('Approval timed out');\n  }\n}`,
  },
  python: {
    install: 'pip install agentauth',
    setup: `from agentauth import AgentAuthClient\n\nclient = AgentAuthClient(\n    agent_id="your-agent-id",\n    private_key="your-private-key",\n    api_url="https://api.agentauth.com"\n)`,
    getToken: `# Get a signed JWT token\ntoken = client.get_token()\nprint(token)  # eyJhbGciOiJS...`,
    checkPermission: `# Check if the agent has permission\nresult = client.check_permission(\n    resource_type="database",\n    resource_id="users-table",\n    action="read"\n)\n\nif result["allowed"]:\n    print(f"Access granted via grant: {result['matched_grant_id']}")\nelse:\n    print(f"Denied: {result['reason']}")`,
    submitAction: `# Submit an action (handles approval flow automatically)\ntry:\n    result = client.submit_action(\n        resource_type="database",\n        resource_id="users-table",\n        action="delete",\n        payload={"user_id": "123"}\n    )\n    print(f"Action executed: {result}")\nexcept PermissionDeniedError as e:\n    print(f"Denied: {e}")\nexcept PendingApprovalTimeoutError as e:\n    print(f"Approval timed out: {e}")`,
  },
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="flex items-center justify-between border border-hairline bg-surface px-4 py-2">
        <span className="text-xs text-muted-foreground font-mono">{language}</span>
        <button
          onClick={copyToClipboard}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="border border-t-0 border-hairline bg-surface p-4 overflow-x-auto">
        <code className="text-sm text-foreground font-mono">{code}</code>
      </pre>
    </div>
  );
}

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<'typescript' | 'python'>('typescript');
  const [activeSection, setActiveSection] = useState('install');

  const examples = codeExamples[activeTab];

  const sections = [
    { id: 'install', label: 'Installation' },
    { id: 'setup', label: 'Setup' },
    { id: 'getToken', label: 'Get Token' },
    { id: 'checkPermission', label: 'Check Permission' },
    { id: 'submitAction', label: 'Submit Action' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl">SDK Documentation</h1>
      </div>

      {/* Language tabs */}
      <div className="flex gap-2 mb-6">
        {(['typescript', 'python'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setActiveSection('install'); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-surface'
            }`}
          >
            {tab === 'typescript' ? 'TypeScript' : 'Python'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-0.5">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  activeSection === section.id
                    ? 'bg-surface text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-4">
          <div className="border border-hairline bg-background p-6">
            <h2 className="text-lg mb-4">
              {sections.find(s => s.id === activeSection)?.label}
            </h2>

            {activeSection === 'install' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Install the AgentAuth SDK for {activeTab === 'typescript' ? 'Node.js' : 'Python'}.
                </p>
                <CodeBlock code={examples.install} language="bash" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ExternalLink className="w-4 h-4" />
                  <a
                    href={activeTab === 'typescript' ? 'https://www.npmjs.com/package/agentauth-sdk' : 'https://pypi.org/project/agentauth/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    View on {activeTab === 'typescript' ? 'npm' : 'PyPI'}
                  </a>
                </div>
              </div>
            )}

            {activeSection === 'setup' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Initialize the client with your agent&apos;s credentials. You get these when you register an agent via the API.
                </p>
                <CodeBlock code={examples.setup} language={activeTab === 'typescript' ? 'typescript' : 'python'} />
              </div>
            )}

            {activeSection === 'getToken' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Get a short-lived JWT token. The SDK handles challenge fetching, signing, and exchange automatically. Tokens are cached and refreshed before expiry.
                </p>
                <CodeBlock code={examples.getToken} language={activeTab === 'typescript' ? 'typescript' : 'python'} />
              </div>
            )}

            {activeSection === 'checkPermission' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Check if your agent has permission to perform an action on a resource. Returns whether access is allowed, which grant matched, and whether approval is required.
                </p>
                <CodeBlock code={examples.checkPermission} language={activeTab === 'typescript' ? 'typescript' : 'python'} />
              </div>
            )}

            {activeSection === 'submitAction' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Submit an action for execution. If the action requires human approval, the SDK will poll for the decision (or you can use webhooks). Throws typed errors for denied, expired, or timed-out scenarios.
                </p>
                <CodeBlock code={examples.submitAction} language={activeTab === 'typescript' ? 'typescript' : 'python'} />
              </div>
            )}
          </div>

          {/* API Reference link */}
          <div className="border border-hairline bg-background p-6">
            <div className="flex items-center gap-3">
              <Code className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-medium">Full API Reference</h3>
                <p className="text-xs text-muted-foreground">
                  Explore all endpoints, request/response shapes, and error codes.
                </p>
              </div>
              <a
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                OpenAPI Docs <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
