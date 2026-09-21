#!/usr/bin/env node
/**
 * Agent Treasury MCP server (PRD §12.5, FR-API-3).
 *
 * Tools: request_payment · check_budget · list_mandates · get_payment_status
 *
 * The server authenticates as the agent: env AGENTAUTH_AGENT_ID +
 * AGENTAUTH_PRIVATE_KEY (Ed25519 PKCS8 PEM) drive the same DPoP-style proof
 * the SDK sends, OR AGENTAUTH_API_KEY (ak_…) for operator-style access.
 * Per PRD, the MCP server can never approve, edit policy, or engage/release
 * kill switches — those surfaces are deliberately not exposed.
 *
 * Runs over stdio; configure in any MCP client:
 *   { "command": "npx", "args": ["-y", "agentauth-treasury-mcp"],
 *     "env": { "AGENTAUTH_API_URL": "http://localhost:4000", "AGENTAUTH_AGENT_ID": "…", "AGENTAUTH_PRIVATE_KEY": "…" } }
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as crypto from 'crypto';

const API_URL = process.env.AGENTAUTH_API_URL ?? 'http://localhost:4000';
const AGENT_ID = process.env.AGENTAUTH_AGENT_ID ?? '';
const PRIVATE_KEY = process.env.AGENTAUTH_PRIVATE_KEY ?? '';
const API_KEY = process.env.AGENTAUTH_API_KEY ?? '';

interface ToolError extends Error {
  code?: string;
}

async function api<T>(method: 'GET' | 'POST', path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...extraHeaders };
  if (API_KEY) headers['authorization'] = `Bearer ${API_KEY}`;
  else if (PRIVATE_KEY) headers['authorization'] = `Bearer ${await agentToken()}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`API ${res.status}: ${typeof json?.message === 'string' ? json.message : JSON.stringify(json?.message ?? json)}`) as ToolError;
    err.code = json?.code;
    throw err;
  }
  return json as T;
}

/** Minimal agent-token cache (challenge → sign → exchange), SDK-equivalent. */
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
async function agentToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken;
  if (!AGENT_ID || !PRIVATE_KEY) throw new Error('AGENTAUTH_AGENT_ID and AGENTAUTH_PRIVATE_KEY (or AGENTAUTH_API_KEY) are required');
  const challenge = await api<{ nonce: string }>('GET', `/api/v1/tokens/challenge?agent_id=${encodeURIComponent(AGENT_ID)}`);
  const signature = crypto.sign(null, Buffer.from(challenge.nonce), crypto.createPrivateKey(PRIVATE_KEY)).toString('base64');
  const token = await api<{ token: string; expires_at: string }>('POST', '/api/v1/tokens', {
    agent_id: AGENT_ID,
    challenge_nonce: challenge.nonce,
    signed_challenge: signature,
  });
  cachedToken = token.token;
  tokenExpiresAt = new Date(token.expires_at).getTime();
  return token.token;
}

/** DPoP-style proof over the canonical authorize body (mirrors the SDK). */
function authorizeProof(body: Record<string, unknown>): string | null {
  if (!PRIVATE_KEY) return null;
  const canonical = JSON.stringify(body, Object.keys(body).sort());
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  return crypto.sign(null, Buffer.from(hash, 'hex'), crypto.createPrivateKey(PRIVATE_KEY)).toString('base64');
}

const server = new McpServer({ name: 'agentauth-treasury', version: '0.1.0' });

server.registerTool(
  'request_payment',
  {
    title: 'Request a payment',
    description:
      'Ask the treasury to authorize a payment under the agent mandate. Returns allow (with rail credential), deny (with reason codes), or pending_approval. Deterministic policy decision — never call this for amounts you cannot justify.',
    inputSchema: {
      rail: z.enum(['manual', 'x402', 'card', 'upi_uap']),
      value: z.string().describe('Decimal amount, e.g. "0.75"'),
      asset: z.enum(['USDC', 'INR', 'USD']),
      counterparty_identifier: z.string().describe('Domain, merchant id, or wallet identifier'),
      counterparty_kind: z.enum(['api_service', 'merchant', 'agent', 'wallet', 'bank_account']).optional(),
      purpose: z.string().optional(),
      task_ref: z.string().optional(),
      network: z.string().optional().describe('x402 only: base-sepolia | base'),
      pay_to: z.string().optional().describe('x402 only: recipient address from the 402 response'),
      resource: z.string().optional().describe('x402 only: the paid resource URL'),
    },
  },
  async (input) => {
    const body: Record<string, unknown> = {
      rail: input.rail,
      amount: { value: input.value, asset: input.asset },
      counterparty: { kind: input.counterparty_kind ?? 'api_service', identifier: input.counterparty_identifier },
      purpose: input.purpose,
      task_ref: input.task_ref,
      environment: 'sandbox',
      agent_id: AGENT_ID || undefined,
    };
    if (input.rail === 'x402') {
      body.rail_details = { network: input.network ?? 'base-sepolia', pay_to: input.pay_to, resource: input.resource };
    }
    const proof = authorizeProof(body);
    const decision = await api<any>('POST', '/api/v1/treasury/payments/authorize', body, {
      'idempotency-key': crypto.randomUUID(),
      ...(proof ? { 'x-agentauth-proof': proof } : {}),
    });
    const lines = [`decision: ${decision.decision}`, `status: ${decision.status}`, `intent_id: ${decision.intent_id}`];
    for (const r of decision.reasons ?? []) lines.push(`reason: ${r.rule_id ?? r.code ?? ''} ${r.message}`.trim());
    if (decision.credential?.payload?.['X-PAYMENT']) {
      lines.push(`payment_header: ${decision.credential.payload['X-PAYMENT']}`);
      lines.push('Retry the paid request with the X-PAYMENT header, then call get_payment_status / confirm with the receipt.');
    }
    if (decision.status === 'pending_approval') {
      lines.push('Awaiting human approval — poll get_payment_status.');
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);

server.registerTool(
  'check_budget',
  {
    title: 'Check budget',
    description: 'Remaining spend authority for a budget in the current period.',
    inputSchema: {
      budget_id: z.string().describe('Budget uuid (from your operator or a prior payment response)'),
    },
  },
  async ({ budget_id }) => {
    const r = await api<any>('GET', `/api/v1/treasury/budgets/${encodeURIComponent(budget_id)}/remaining`);
    return { content: [{ type: 'text', text: `remaining: ${r.remaining_minor} minor (${r.asset ?? ''})\nperiod ends: ${r.period_end}` }] };
  },
);

server.registerTool(
  'list_mandates',
  {
    title: 'List mandates',
    description: 'Active mandates and their limits for the calling agent (its spending authority).',
    inputSchema: {},
  },
  async () => {
    if (!AGENT_ID && !API_KEY) throw new Error('AGENTAUTH_AGENT_ID is required to list the agent mandates');
    const org = process.env.AGENTAUTH_ORG_ID;
    const mandates = await api<any[]>('GET', `/api/v1/treasury/mandates${org ? `?org_id=${org}` : ''}${AGENT_ID ? `${org ? '&' : '?'}agent_id=${AGENT_ID}` : ''}`);
    const active = mandates.filter((m) => m.status === 'active');
    if (active.length === 0) return { content: [{ type: 'text', text: 'No active mandates — no spend authority.' }] };
    const text = active
      .map((m) => {
        const limits = m.hard_limits ?? {};
        return [
          `mandate: ${m.id}`,
          `valid until: ${m.valid_until}`,
          `max per txn: ${limits.max_per_txn_minor ?? 'unlimited'} minor`,
          `budget: ${limits.budget_id ?? 'none'}`,
        ].join('\n');
      })
      .join('\n---\n');
    return { content: [{ type: 'text', text }] };
  },
);

server.registerTool(
  'get_payment_status',
  {
    title: 'Get payment status',
    description: 'Poll a payment intent: decision, lifecycle status, reasons, rail reference.',
    inputSchema: {
      intent_id: z.string(),
    },
  },
  async ({ intent_id }) => {
    const intent = await api<any>('GET', `/api/v1/treasury/payments/${encodeURIComponent(intent_id)}`);
    const lines = [
      `status: ${intent.status}`,
      `decision: ${intent.decision ?? 'n/a'}`,
      `amount: ${intent.amount_minor} minor ${intent.asset_code}`,
      `rail: ${intent.rail}`,
    ];
    for (const r of intent.decision_reasons ?? []) lines.push(`reason: ${r.rule_id ?? r.code ?? ''} ${r.message}`.trim());
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP protocol channel.
  console.error(`agentauth-treasury MCP ready (${API_URL}, agent ${AGENT_ID || 'n/a'})`);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
