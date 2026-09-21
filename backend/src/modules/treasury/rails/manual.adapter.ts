import { Injectable } from '@nestjs/common';
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

/**
 * Manual / advisory rail (FR-PAY-3): the platform decides and records; the
 * customer executes outside (bank transfer, UPI app, wire) and reports back
 * via `confirm`. Works with zero rail credentials — this is the launch rail.
 * The "credential" is the spend token itself plus a human-executable
 * instruction; the ledger records the confirmation evidence verbatim.
 */
@Injectable()
export class ManualRailAdapter implements RailAdapter {
  readonly rail = 'manual' as const;

  capabilities() {
    return { platformExecutes: false, supportsRefund: false, assets: ['INR', 'USD', 'USDC'] };
  }

  async prepare(
    intent: { amount_minor: string; asset_code: string; counterparty: { kind?: string; identifier: string }; rail_details?: Record<string, any> },
    _ctx: AdapterContext,
  ): Promise<PreparedPayment> {
    if (!intent.counterparty?.identifier) {
      throw new Error('manual rail requires a counterparty identifier');
    }
    return {
      rail: 'manual',
      counterparty: intent.counterparty,
      amount_minor: intent.amount_minor,
      asset_code: intent.asset_code,
      details: intent.rail_details ?? {},
    };
  }

  async issueCredential(
    prepared: PreparedPayment,
    auth: SpendAuthorization,
    _ctx: AdapterContext,
  ): Promise<Credential> {
    return {
      kind: 'instruction',
      payload: {
        execute: 'off-platform',
        pay_to: prepared.counterparty.identifier,
        amount_minor: prepared.amount_minor,
        asset: prepared.asset_code,
        spend_token: auth.token,
        reference: auth.intent_id,
      },
      provider_ref: `manual:${auth.intent_id}`,
      expires_at: auth.expires_at,
    };
  }

  async confirm(_intentId: string, evidence: RailEvidence, _ctx: AdapterContext): Promise<ConfirmationResult> {
    // The customer attests the money moved; the ledger stores the evidence.
    return { ok: !!evidence.rail_ref, settled: true, provider_ref: evidence.rail_ref };
  }

  async reconcile(
    entries: Array<{ intent_id: string; amount_minor: string; asset_code: string; rail_ref: string | null }>,
    _window: TimeWindow,
    _ctx: AdapterContext,
  ): Promise<ReconciliationReport> {
    // Manual rail has no provider records to compare against; confirmations
    // themselves are the evidence. Flag settled captures missing a rail_ref.
    const mismatches = entries
      .filter((e) => !e.rail_ref)
      .map((e) => ({ intent_id: e.intent_id, reason: 'manual capture without confirmation evidence' }));
    return { checked: entries.length, matched: entries.length - mismatches.length, mismatches };
  }

  async assertNotRevoked(auth: SpendAuthorization, status: { revoked_at: Date | null; consumed_at: Date | null; expires_at: Date }): Promise<void> {
    if (status.revoked_at) throw new Error('spend authorization revoked');
    if (status.consumed_at) throw new Error('spend authorization already used');
    if (status.expires_at < new Date()) throw new Error('spend authorization expired');
    void auth;
  }
}
