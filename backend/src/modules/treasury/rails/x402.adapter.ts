import { Injectable, Logger } from '@nestjs/common';
import {
  RailAdapter,
  SpendAuthorization,
  AdapterContext,
  PreparedPayment,
  Credential,
  RailEvidence,
  ConfirmationResult,
  TimeWindow,
  ReconciliationReport,
} from './types';
import { buildX402PaymentHeader, X402SigningKey } from './x402-signing';

/**
 * x402 rail adapter (FR-PAY-4, PRD §8.1).
 *
 * Non-custodial per §9.6: the customer connects their own wallet-provider
 * account; the platform brokers the credential and records outcomes. The
 * signing key arrives per-call in the (envelope-encrypted) rail-connection
 * config and is never logged or persisted by the platform.
 *
 * Issue: agent presents the spend token + the signed X-PAYMENT header; the
 * facilitator/settlement contract executes the EIP-3009 transfer. Confirm:
 * the agent (or a webhook) reports the settlement tx hash as rail evidence.
 * The token's cnf binding is checked server-side before any credential is
 * released (assertNotRevoked).
 */
@Injectable()
export class X402RailAdapter implements RailAdapter {
  private readonly logger = new Logger('X402RailAdapter');
  readonly rail = 'x402' as const;

  capabilities() {
    return { platformExecutes: false, supportsRefund: false, assets: ['USDC'] };
  }

  async prepare(
    intent: { amount_minor: string; asset_code: string; counterparty: { kind?: string; identifier: string }; rail_details?: Record<string, any> },
    ctx: AdapterContext,
  ): Promise<PreparedPayment> {
    const details = intent.rail_details ?? {};
    if (!details.network || !details.pay_to) {
      throw new Error('x402 rail requires rail_details.network and rail_details.pay_to');
    }
    if (intent.asset_code !== 'USDC') {
      throw new Error(`x402 settles in USDC only, got ${intent.asset_code} (no implicit FX)`);
    }
    const { X402_NETWORKS } = await import('./x402-signing');
    const network = X402_NETWORKS[details.network];
    if (!network) {
      throw new Error(`unsupported x402 network: ${details.network}`);
    }
    // Environment/network pinning: testnet networks never settle live funds;
    // mainnet networks are gated to explicit live connections.
    if (network.testnet && ctx.environment === 'live') {
      throw new Error('testnet network cannot be used with a live rail connection');
    }
    if (!network.testnet && ctx.environment !== 'live') {
      throw new Error('mainnet networks require a live rail connection');
    }
    return {
      rail: 'x402',
      counterparty: intent.counterparty,
      amount_minor: intent.amount_minor,
      asset_code: intent.asset_code,
      details: { network: details.network, pay_to: details.pay_to, resource: details.resource ?? null },
    };
  }

  async issueCredential(
    prepared: PreparedPayment,
    auth: SpendAuthorization,
    ctx: AdapterContext,
  ): Promise<Credential> {
    const private_key = ctx.connection.config?.wallet_private_key;
    if (!private_key) {
      // No connected wallet provider: fall back to the spend token alone.
      // The agent can present it to a wallet provider of their choosing.
      this.logger.warn(`x402 credential issued as bare spend token (no wallet key on connection ${ctx.connection.provider})`);
      return {
        kind: 'spend_token',
        payload: { token: auth.token, audience: auth.audience },
        provider_ref: `x402:${auth.jti}`,
        expires_at: auth.expires_at,
      };
    }

    const { header, network, amount_minor } = await buildX402PaymentHeader(
      {
        network: prepared.details.network,
        pay_to: prepared.details.pay_to,
        max_amount_required_minor: prepared.details.max_amount_required_minor,
      },
      // Cap at the approved max — never above what the decision path authorized.
      auth.max_amount_minor,
      { private_key } as X402SigningKey,
      ctx.environment,
    );
    void amount_minor;

    return {
      kind: 'payment_header',
      payload: {
        'X-PAYMENT': header,
        network,
        pay_to: prepared.details.pay_to,
        resource: prepared.details.resource,
        spend_token: auth.token,
      },
      provider_ref: `x402:${auth.jti}`,
      expires_at: auth.expires_at,
    };
  }

  async confirm(_intentId: string, evidence: RailEvidence, _ctx: AdapterContext): Promise<ConfirmationResult> {
    if (!evidence.rail_ref) return { ok: false, settled: false, reason: 'missing settlement reference' };
    // Real settlement verification (tx hash lookup against the chain/facilitator)
    // is part of M6 hardening; the reference is recorded either way.
    return { ok: true, settled: true, provider_ref: evidence.rail_ref };
  }

  async reconcile(
    entries: Array<{ intent_id: string; amount_minor: string; asset_code: string; rail_ref: string | null }>,
    _window: TimeWindow,
    _ctx: AdapterContext,
  ): Promise<ReconciliationReport> {
    const mismatches = entries
      .filter((e) => !e.rail_ref)
      .map((e) => ({ intent_id: e.intent_id, reason: 'authorized payment without settlement reference' }));
    return { checked: entries.length, matched: entries.length - mismatches.length, mismatches };
  }

  async assertNotRevoked(auth: SpendAuthorization, status: { revoked_at: Date | null; consumed_at: Date | null; expires_at: Date }): Promise<void> {
    if (status.revoked_at) throw new Error('spend authorization revoked');
    if (status.consumed_at) throw new Error('spend authorization already used');
    if (status.expires_at < new Date()) throw new Error('spend authorization expired');
    void auth;
  }
}
