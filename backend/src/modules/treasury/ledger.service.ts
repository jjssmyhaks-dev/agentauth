import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { TreasuryLedgerEntry } from './treasury-entities';

export interface LedgerWriteInput {
  org_id: string;
  entry_type: TreasuryLedgerEntry['entry_type'];
  payment_intent_id?: string | null;
  agent_id?: string | null;
  mandate_id?: string | null;
  policy_version_id?: string | null;
  matched_rule_id?: string | null;
  principal_ids?: string[];
  counterparty_id?: string | null;
  amount_minor?: string | null;
  asset_code?: string | null;
  rail_ref?: string | null;
  correlation_id: string;
}

/**
 * Append-only, per-org hash-chained ledger (PRD FR-LED-1/2).
 *
 * The chain is serialized per org with a Postgres advisory lock so concurrent
 * writers can't fork the chain: prev_hash is always the last committed
 * entry's hash. Immutability itself (no UPDATE/DELETE) is enforced by the RLS/
 * permissions SQL script — this service only ever inserts.
 */
@Injectable()
export class TreasuryLedgerService {
  private readonly logger = new Logger(TreasuryLedgerService.name);

  constructor(
    @InjectRepository(TreasuryLedgerEntry)
    private ledgerRepo: Repository<TreasuryLedgerEntry>,
  ) {}

  private static hashEntry(prevHash: string, fields: Record<string, unknown>): string {
    const payload = JSON.stringify(fields);
    return crypto.createHash('sha256').update(prevHash + payload).digest('hex');
  }

  /** Append one entry inside a transaction guarded by the org's advisory lock. */
  async append(input: LedgerWriteInput): Promise<TreasuryLedgerEntry> {
    return this.ledgerRepo.manager.transaction(async (em) => {
      // Serialize chain appends per org (deterministic lock order: org uuid).
      await em.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [input.org_id]);

      const prev = await em
        .getRepository(TreasuryLedgerEntry)
        .findOne({ where: { org_id: input.org_id }, order: { seq: 'DESC' } });
      const prevHash = prev?.entry_hash ?? '0';

      // One timestamp, used for BOTH the hash and the stored row. Two separate
      // new Date() calls can straddle a clock tick and permanently break the
      // chain (the hash would cover a timestamp that was never persisted).
      const occurredAt = new Date();

      const fields = {
        org_id: input.org_id,
        entry_type: input.entry_type,
        payment_intent_id: input.payment_intent_id ?? null,
        agent_id: input.agent_id ?? null,
        mandate_id: input.mandate_id ?? null,
        policy_version_id: input.policy_version_id ?? null,
        matched_rule_id: input.matched_rule_id ?? null,
        principal_ids: input.principal_ids ?? [],
        counterparty_id: input.counterparty_id ?? null,
        amount_minor: input.amount_minor ?? null,
        asset_code: input.asset_code ?? null,
        rail_ref: input.rail_ref ?? null,
        correlation_id: input.correlation_id,
        occurred_at: occurredAt.toISOString(),
      };
      const entryHash = TreasuryLedgerService.hashEntry(prevHash, fields);

      const entry = em.getRepository(TreasuryLedgerEntry).create({
        ...input,
        principal_ids: input.principal_ids ?? [],
        occurred_at: occurredAt,
        prev_hash: prevHash,
        entry_hash: entryHash,
      } as unknown as TreasuryLedgerEntry);
      return em.getRepository(TreasuryLedgerEntry).save(entry);
    });
  }

  async listForOrg(orgId: string, limit = 100, offset = 0): Promise<{ data: TreasuryLedgerEntry[]; total: number }> {
    const [data, total] = await this.ledgerRepo.findAndCount({
      where: { org_id: orgId },
      order: { seq: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  /**
   * Recompute the whole chain for an org and report the first broken index.
   * Mirrors the write-side field list exactly.
   */
  async verifyChain(orgId: string): Promise<{ valid: boolean; checked_entries: number; broken_at_seq?: string }> {
    const entries = await this.ledgerRepo.find({
      where: { org_id: orgId },
      order: { seq: 'ASC' },
    });
    let prevHash = '0';
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const fields = {
        org_id: e.org_id,
        entry_type: e.entry_type,
        payment_intent_id: e.payment_intent_id ?? null,
        agent_id: e.agent_id ?? null,
        mandate_id: e.mandate_id ?? null,
        policy_version_id: e.policy_version_id ?? null,
        matched_rule_id: e.matched_rule_id ?? null,
        principal_ids: e.principal_ids ?? [],
        counterparty_id: e.counterparty_id ?? null,
        amount_minor: e.amount_minor ?? null,
        asset_code: e.asset_code ?? null,
        rail_ref: e.rail_ref ?? null,
        correlation_id: e.correlation_id,
        occurred_at: e.occurred_at?.toISOString?.() ?? e.occurred_at,
      };
      const expected = TreasuryLedgerService.hashEntry(prevHash, fields);
      if (e.prev_hash !== prevHash || e.entry_hash !== expected) {
        return { valid: false, checked_entries: i, broken_at_seq: e.seq };
      }
      prevHash = e.entry_hash;
    }
    return { valid: true, checked_entries: entries.length };
  }
}
