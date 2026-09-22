/**
 * Agent Treasury client for the AgentAuth SDK (PRD §12.4, FR-API-2).
 *
 * The treasury namespace rides on the existing agent keypair auth: every
 * authorize call carries an Ed25519 DPoP-style proof over the canonical
 * request hash, so a stolen bearer token alone cannot authorize spend.
 *
 * Quickstart:
 * ```ts
 * const agent = new AgentAuthClient(agentId, privateKeyPem, apiUrl);
 * const decision = await agent.treasury.authorize({
 *   rail: 'x402',
 *   amount: { value: '0.75', asset: 'USDC' },
 *   counterparty: { kind: 'api_service', identifier: 'api.example.com' },
 *   purpose: 'market_data_lookup',
 *   railDetails: { network: 'base-sepolia', pay_to: '0x…', resource: 'https://…' },
 * }, { idempotencyKey: 'task_8841:quote' });
 *
 * if (decision.status === 'authorized') {
 *   // retry the paid request with decision.credential.payload['X-PAYMENT']
 *   await agent.treasury.confirm(decision.intent_id, { rail_ref: receiptId });
 * }
 * ```
 */
import * as crypto from 'crypto';
import { AgentAuthError } from './errors';

export interface TreasuryAmount {
  value: string;
  asset: 'INR' | 'USD' | 'USDC' | string;
}

export interface AuthorizeParams {
  rail: 'manual' | 'x402' | 'card' | 'upi_uap';
  amount: TreasuryAmount;
  counterparty: { kind?: string; identifier: string };
  purpose?: string;
  taskRef?: string;
  environment?: 'sandbox' | 'live';
  railDetails?: Record<string, any>;
  agentId?: string; // required when authenticating with an org API key
}

export interface TreasuryReason {
  rule_id?: string;
  code?: string;
  message: string;
}

export interface AuthorizeDecision {
  intent_id: string;
  decision: 'allow' | 'deny' | 'require_approval' | 'allow_with_cap';
  status: string;
  reasons: TreasuryReason[];
  authorization?: { token: string; expires_at: string; audience: string };
  credential?: { kind: string; payload: Record<string, any>; provider_ref: string; expires_at: string };
  approval?: { id: string; expires_at: string };
  budget?: { remaining: string; asset: string; period_ends_at: string };
}

export interface TreasuryRequester {
  /** Raw JSON POST/GET with the requester's auth headers already attached. */
  request<T>(method: 'GET' | 'POST', path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T>;
  /** Ed25519 private key (PKCS8 PEM) used to sign the DPoP-style proof. */
  privateKey: string;
  agentId: string;
}

export class TreasuryClient {
  constructor(private readonly requester: TreasuryRequester) {}

  /**
   * Create a payment intent and get the deterministic decision (FR-PAY-1).
   * Sends an Ed25519 proof over sha256(canonical request) — T2 mitigation.
   */
  async authorize(params: AuthorizeParams, opts?: { idempotencyKey?: string }): Promise<AuthorizeDecision> {
    const idempotencyKey = opts?.idempotencyKey ?? crypto.randomUUID();
    const body = {
      task_ref: params.taskRef,
      rail: params.rail,
      amount: params.amount,
      counterparty: params.counterparty,
      purpose: params.purpose,
      environment: params.environment ?? 'sandbox',
      rail_details: params.railDetails,
      agent_id: params.agentId ?? this.requester.agentId,
    };
    const proof = this.signProof(body);
    return this.requester.request<AuthorizeDecision>(
      'POST',
      '/api/v1/treasury/payments/authorize',
      body,
      { 'idempotency-key': idempotencyKey, 'x-agentauth-proof': proof },
    );
  }

  /** Poll intent status. */
  async getStatus(intentId: string): Promise<Record<string, any>> {
    return this.requester.request('GET', `/api/v1/treasury/payments/${encodeURIComponent(intentId)}`);
  }

  /** Report rail evidence (receipt, tx hash); captures the reservation (§8.1.5). */
  async confirm(intentId: string, evidence: { rail_ref: string; note?: string }): Promise<AuthorizeDecision> {
    return this.requester.request(
      'POST',
      `/api/v1/treasury/payments/${encodeURIComponent(intentId)}/confirm`,
      evidence,
    );
  }

  /** Cancel and release the reservation. */
  async cancel(intentId: string): Promise<AuthorizeDecision> {
    return this.requester.request('POST', `/api/v1/treasury/payments/${encodeURIComponent(intentId)}/cancel`);
  }

  /** Remaining authority: mandate, budgets, limits (FR-API-1 /v1/authority). */
  async getAuthority(): Promise<Record<string, any>> {
    return this.requester.request('GET', '/api/v1/treasury/mandates');
  }

  /**
   * x402 helper (§8.1): authorize, return the payment header for the retry,
   * and optionally confirm with the receipt afterwards.
   */
  async x402Authorize(params: {
    network: string;
    payTo: string;
    resource?: string;
    amount: TreasuryAmount;
    counterpartyIdentifier: string;
    purpose?: string;
    taskRef?: string;
    agentId?: string;
  }, opts?: { idempotencyKey?: string }): Promise<{ decision: AuthorizeDecision; paymentHeader?: string }> {
    const decision = await this.authorize({
      rail: 'x402',
      amount: params.amount,
      counterparty: { kind: 'api_service', identifier: params.counterpartyIdentifier },
      purpose: params.purpose,
      taskRef: params.taskRef,
      railDetails: { network: params.network, pay_to: params.payTo, resource: params.resource },
      agentId: params.agentId,
    }, opts);
    if (decision.status !== 'authorized' || !decision.credential?.payload?.['X-PAYMENT']) {
      return { decision };
    }
    return { decision, paymentHeader: decision.credential.payload['X-PAYMENT'] as string };
  }

  /** Wait for a pending approval to resolve (polls; §12.4 waitForApproval). */
  async waitForApproval(intentId: string, opts?: { timeoutMs?: number; intervalMs?: number }): Promise<AuthorizeDecision> {
    const timeout = opts?.timeoutMs ?? 4 * 3600 * 1000;
    const interval = opts?.intervalMs ?? 5000;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const status = await this.getStatus(intentId);
      if (['authorized', 'settled', 'denied', 'expired', 'cancelled'].includes(status.status)) {
        return status as AuthorizeDecision;
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new AgentAuthError(`Approval for intent ${intentId} timed out`);
  }

  /**
   * DPoP-style proof: Ed25519 signature over sha256(canonical body), with the
   * issuance time appended ("<base64sig>.<issued_at_ms>") so the backend can
   * enforce a ±5-minute freshness window on top of server-side replay
   * protection. canonicalize() must match the backend's proof-verification
   * canonicalizeBody() exactly: recursive sorted keys (a top-level-only sort
   * would drop nested keys and break every signature).
   */
  private signProof(body: unknown): string {
    const hash = crypto.createHash('sha256').update(canonicalize(body)).digest('hex');
    const sig = crypto.sign(null, Buffer.from(hash, 'hex'), crypto.createPrivateKey(this.requester.privateKey)).toString('base64');
    return `${sig}.${Date.now()}`;
  }
}

/** Recursive sorted-key JSON — byte-identical to the backend's canonicalJson. */
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value as object).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
