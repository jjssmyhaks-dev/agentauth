import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TreasuryRailConnection } from '../treasury-entities-rails';
import { RailAdapter, RailType, AdapterContext, PreparedPayment, SpendAuthorization, RailEvidence, TimeWindow, ConfirmationResult, ReconciliationReport } from './types';
import { ManualRailAdapter } from './manual.adapter';
import { X402RailAdapter } from './x402.adapter';

/**
 * Rail registry (FR-PAY-2): resolves the adapter for a rail and funnels
 * prepare → issueCredential → confirm/reconcile through it. The decision
 * path (policy → budget → authorize) stays in TreasuryService; adapters only
 * touch credential brokering and rail I/O — never the policy decision.
 *
 * Connections are the customer's own provider accounts (§9.6). Only the
 * non-secret `config` reaches the AdapterContext; `credentials_ciphertext`
 * stays in the entity until a KMS-enabled adapter asks for it (NFR-4).
 */
@Injectable()
export class RailsService {
  private readonly logger = new Logger('RailsService');
  private readonly adapters = new Map<RailType, RailAdapter>();

  constructor(
    manual: ManualRailAdapter,
    x402: X402RailAdapter,
    @InjectRepository(TreasuryRailConnection)
    private readonly connectionRepo: Repository<TreasuryRailConnection>,
  ) {
    for (const a of [manual, x402]) this.adapters.set(a.rail, a);
  }

  get(rail: RailType): RailAdapter {
    const adapter = this.adapters.get(rail);
    if (!adapter) throw new Error(`no adapter registered for rail ${rail}`);
    return adapter;
  }

  /** Resolve the customer's active connection config for the rail. */
  async connectionFor(orgId: string, rail: RailType, environment: 'sandbox' | 'live'): Promise<AdapterContext['connection']> {
    try {
      const conn = await this.connectionRepo.findOne({
        where: { org_id: orgId, rail, environment, status: 'active' },
        order: { created_at: 'DESC' },
      });
      if (!conn) return { provider: rail === 'manual' ? 'manual' : 'none', config: {} };
      return { provider: conn.provider, config: conn.config ?? {} };
    } catch (err: any) {
      this.logger.warn(`connection lookup failed (proceeding without): ${err?.message ?? err}`);
      return { provider: 'none', config: {} };
    }
  }

  async prepare(rail: RailType, intent: { amount_minor: string; asset_code: string; counterparty: { kind?: string; identifier: string }; rail_details?: Record<string, any> }, ctx: AdapterContext): Promise<PreparedPayment> {
    return this.get(rail).prepare(intent, ctx);
  }

  async issueCredential(rail: RailType, prepared: PreparedPayment, auth: SpendAuthorization, ctx: AdapterContext): Promise<ReturnType<RailAdapter['issueCredential']>> {
    return this.get(rail).issueCredential(prepared, auth, ctx);
  }

  async confirm(rail: RailType, intentId: string, evidence: RailEvidence, ctx: AdapterContext): Promise<ConfirmationResult> {
    return this.get(rail).confirm(intentId, evidence, ctx);
  }

  async reconcile(rail: RailType, entries: Array<{ intent_id: string; amount_minor: string; asset_code: string; rail_ref: string | null }>, window: TimeWindow, ctx: AdapterContext): Promise<ReconciliationReport> {
    return this.get(rail).reconcile(entries, window, ctx);
  }

  /** Adapters registered (exposed for OpenAPI/docs and the dashboard). */
  registeredRails(): RailType[] {
    return [...this.adapters.keys()];
  }
}
