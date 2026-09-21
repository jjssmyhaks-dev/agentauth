import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../../database/entities/organization.entity';
import { Agent } from '../../database/entities/agent.entity';

// ── Shared enums (Text columns + check-style validation in services, since
//    this codebase's convention is string unions rather than PG enums) ──

export type RailType = 'manual' | 'x402' | 'card' | 'upi_uap';
export type TreasuryEnvironment = 'sandbox' | 'live';
export type IntentStatus =
  | 'received' | 'denied' | 'pending_approval' | 'approved' | 'authorized'
  | 'executing' | 'settled' | 'failed' | 'expired' | 'cancelled' | 'refunded';
export type DecisionEffect = 'allow' | 'deny' | 'require_approval' | 'allow_with_cap';
export type ReservationStatus = 'held' | 'captured' | 'released';
export type BudgetScope = 'org' | 'team' | 'agent' | 'task';
export type BudgetPeriodKind = 'one_time' | 'daily' | 'weekly' | 'monthly' | 'rolling_30d';

/** Known assets — mirrors treasury.assets seed; amounts are minor units. */
export const TREASURY_ASSETS: Record<string, { decimals: number; kind: 'fiat' | 'stablecoin' }> = {
  INR: { decimals: 2, kind: 'fiat' },
  USD: { decimals: 2, kind: 'fiat' },
  USDC: { decimals: 6, kind: 'stablecoin' },
};

/** Convert a decimal string to minor units using asset decimals. Throws on unknown asset. */
export function toMinorUnits(value: string, assetCode: string): bigint {
  const asset = TREASURY_ASSETS[assetCode];
  if (!asset) throw new Error(`Unknown asset ${assetCode}`);
  const neg = value.trim().startsWith('-');
  const [whole, fracRaw = ''] = value.trim().replace(/^-/, '').split('.');
  const frac = (fracRaw + '0'.repeat(asset.decimals)).slice(0, asset.decimals);
  const minor = BigInt(whole + frac);
  return neg ? -minor : minor;
}

/** Minor units → decimal string (for API responses). */
export function fromMinorUnits(minor: bigint, assetCode: string): string {
  const asset = TREASURY_ASSETS[assetCode];
  if (!asset) throw new Error(`Unknown asset ${assetCode}`);
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const s = abs.toString().padStart(asset.decimals + 1, '0');
  const whole = s.slice(0, s.length - asset.decimals);
  const frac = asset.decimals > 0 ? '.' + s.slice(s.length - asset.decimals) : '';
  return (neg ? '-' : '') + whole + frac;
}

// ── Entities ──────────────────────────────────────────────────────────────

@Entity('treasury_policies')
@Index(['org_id'])
export class TreasuryPolicy {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'org_id' }) organization: Organization;
  @Column() name: string;
  @Column({ default: 'draft' }) status: 'draft' | 'active' | 'archived';
  @Column({ type: 'uuid', nullable: true }) active_version_id: string | null;
  @CreateDateColumn() created_at: Date;
}

@Entity('treasury_policy_versions')
@Index(['org_id'])
@Index(['policy_id', 'version'], { unique: true })
export class TreasuryPolicyVersion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'uuid' }) policy_id: string;
  @Column({ type: 'int' }) version: number;
  /** agent-policy/1 document (§11 of the Treasury PRD). */
  @Column('jsonb') document: Record<string, any>;
  /** sha256 of canonical (sorted-key) JSON. */
  @Column() checksum: string;
  @Column({ type: 'timestamptz', nullable: true }) simulated_at: Date | null;
  @Column({ nullable: true }) created_by: string | null;
  @CreateDateColumn() created_at: Date;
}

@Entity('treasury_mandates')
@Index(['org_id'])
@Index(['agent_id', 'status'])
export class TreasuryMandate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'org_id' }) organization: Organization;
  @Column({ type: 'uuid' }) agent_id: string;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'agent_id' }) agent: Agent;
  @Column({ type: 'uuid' }) granted_by: string;
  @Column({ type: 'uuid' }) policy_version_id: string;
  /** Absolute caps no policy edit can exceed: {max_per_txn_minor, max_period_minor, period_kind, asset_code}. */
  @Column('jsonb') hard_limits: Record<string, any>;
  @Column({ type: 'timestamptz' }) valid_from: Date;
  @Column({ type: 'timestamptz' }) valid_until: Date;
  @Column() canonical_hash: string;
  /** base64 signature over canonical_hash. */
  @Column() signature: string;
  @Column() signing_method: 'webauthn' | 'eip712' | 'ed25519_test';
  @Column() signing_key_ref: string;
  @Column({ default: 'active' }) status: 'active' | 'revoked' | 'expired';
  @Column({ type: 'timestamptz', nullable: true }) revoked_at: Date | null;
  @Column({ nullable: true }) revoked_by: string | null;
  @Column({ nullable: true }) revoked_reason: string | null;
  @CreateDateColumn() created_at: Date;
}

@Entity('treasury_counterparties')
@Index(['org_id'])
@Index(['org_id', 'kind', 'identifier'], { unique: true })
export class TreasuryCounterparty {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column() kind: 'merchant' | 'api_service' | 'agent' | 'wallet' | 'bank_account';
  @Column() identifier: string;
  @Column({ nullable: true }) display_name: string | null;
  @Column({ nullable: true }) category: string | null;
  /** Named allowlist membership (policy `counterparty.in_list` matches this). */
  @Column({ nullable: true }) list_name: string | null;
  @Column({ default: false }) allowlisted: boolean;
  @Column({ default: false }) denylisted: boolean;
  @CreateDateColumn() created_at: Date;
}

@Entity('treasury_budgets')
@Index(['org_id'])
export class TreasuryBudget {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column() name: string;
  @Column() scope_type: BudgetScope;
  /** uuid for org/team/agent scopes; free text for task scope. */
  @Column({ type: 'uuid', nullable: true }) scope_id: string | null;
  @Column({ type: 'uuid', nullable: true }) parent_budget_id: string | null;
  @Column() asset_code: string;
  @Column() period_kind: BudgetPeriodKind;
  @Column({ type: 'bigint' }) limit_minor: string;
  @Column({ default: 'active' }) status: 'active' | 'paused' | 'archived';
  @CreateDateColumn() created_at: Date;
}

@Entity('treasury_budget_periods')
@Index(['org_id'])
@Index(['budget_id', 'period_start'], { unique: true })
export class TreasuryBudgetPeriod {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'uuid' }) budget_id: string;
  @Column({ type: 'timestamptz' }) period_start: Date;
  @Column({ type: 'timestamptz' }) period_end: Date;
  @Column({ type: 'bigint' }) limit_minor: string;
  @Column({ type: 'bigint', default: 0 }) reserved_minor: string;
  @Column({ type: 'bigint', default: 0 }) spent_minor: string;
  @CreateDateColumn() created_at: Date;
}

@Entity('treasury_payment_intents')
@Index(['org_id'])
@Index(['org_id', 'idempotency_key'], { unique: true })
@Index(['agent_id', 'created_at'])
export class TreasuryPaymentIntent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'org_id' }) organization: Organization;
  @Column({ type: 'uuid' }) agent_id: string;
  @Column({ type: 'uuid' }) mandate_id: string;
  @Column({ type: 'uuid' }) policy_version_id: string;
  @Column({ type: 'uuid', nullable: true }) counterparty_id: string | null;
  @Column({ nullable: true }) task_ref: string | null;
  @Column() rail: RailType;
  @Column({ default: 'sandbox' }) environment: TreasuryEnvironment;
  @Column({ type: 'bigint' }) amount_minor: string;
  @Column() asset_code: string;
  @Column({ nullable: true }) purpose: string | null;
  /** Normalized request (no PAN, no secrets). */
  @Column('jsonb') request: Record<string, any>;
  @Column() request_hash: string;
  @Column({ nullable: true }) decision: DecisionEffect | null;
  @Column('jsonb', { default: [] }) decision_reasons: Array<Record<string, any>>;
  @Column({ nullable: true }) matched_rule_id: string | null;
  @Column({ default: 'received' }) status: IntentStatus;
  @Column() idempotency_key: string;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}

@Entity('treasury_budget_reservations')
@Index(['org_id'])
@Index(['budget_period_id', 'payment_intent_id'], { unique: true })
export class TreasuryBudgetReservation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'uuid' }) budget_period_id: string;
  @Column({ type: 'uuid' }) payment_intent_id: string;
  @Column({ type: 'bigint' }) amount_minor: string;
  @Column({ default: 'held' }) status: ReservationStatus;
  @Column({ type: 'timestamptz' }) expires_at: Date;
  @CreateDateColumn() created_at: Date;
}

@Entity('treasury_approvals')
@Index(['org_id'])
export class TreasuryApproval {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'uuid' }) payment_intent_id: string;
  /** Hash of the canonical intent fields the approver signs over. */
  @Column() intent_hash: string;
  /** Mirror row id in the platform approvals inbox (PendingApproval). */
  @Column({ type: 'uuid', nullable: true }) pending_approval_id: string | null;
  @Column('jsonb') required: Record<string, any>;
  @Column({ default: 'pending' }) status: 'pending' | 'approved' | 'denied' | 'expired';
  @Column({ type: 'timestamptz' }) expires_at: Date;
  @CreateDateColumn() created_at: Date;
}

@Entity('treasury_approval_decisions')
@Index(['org_id'])
@Index(['approval_id', 'principal_id'], { unique: true })
export class TreasuryApprovalDecision {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'uuid' }) approval_id: string;
  @Column({ type: 'uuid' }) principal_id: string;
  @Column() decision: 'approve' | 'deny';
  /** base64 signature over intent_hash by the approver's key. */
  @Column() signature: string;
  @Column({ default: 'dashboard' }) channel: string;
  @CreateDateColumn() decided_at: Date;
}

@Entity('treasury_authorizations')
@Index(['org_id'])
@Index(['jti'], { unique: true })
export class TreasuryAuthorization {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'uuid' }) payment_intent_id: string;
  @Column() jti: string;
  @Column() audience: string;
  @Column({ type: 'bigint' }) max_amount_minor: string;
  @Column() asset_code: string;
  @Column({ type: 'timestamptz' }) expires_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) consumed_at: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) revoked_at: Date | null;
}

@Entity('treasury_kill_switches')
@Index(['org_id'])
export class TreasuryKillSwitch {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column() scope_type: 'org' | 'agent' | 'rail';
  @Column({ type: 'uuid', nullable: true }) scope_id: string | null;
  @Column() engaged_by: string;
  @Column({ type: 'timestamptz', nullable: true }) engaged_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) released_at: Date | null;
  @Column({ nullable: true }) reason: string | null;
}

@Entity('treasury_ledger_entries')
@Index(['org_id'])
@Index(['org_id', 'seq'])
export class TreasuryLedgerEntry {
  @PrimaryGeneratedColumn({ type: 'bigint' }) seq: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column() entry_type:
    | 'decision' | 'reservation' | 'authorization' | 'capture'
    | 'release' | 'refund' | 'adjustment' | 'reversal';
  @Column({ type: 'uuid', nullable: true }) payment_intent_id: string | null;
  @Column({ type: 'uuid', nullable: true }) agent_id: string | null;
  @Column({ type: 'uuid', nullable: true }) mandate_id: string | null;
  @Column({ type: 'uuid', nullable: true }) policy_version_id: string | null;
  @Column({ nullable: true }) matched_rule_id: string | null;
  @Column('jsonb', { default: [] }) principal_ids: string[];
  @Column({ type: 'uuid', nullable: true }) counterparty_id: string | null;
  @Column({ type: 'bigint', nullable: true }) amount_minor: string | null;
  @Column({ nullable: true }) asset_code: string | null;
  @Column({ nullable: true }) rail_ref: string | null;
  @Column() correlation_id: string;
  @Column({ type: 'timestamptz' }) occurred_at: Date;
  @Column() prev_hash: string;
  @Column() entry_hash: string;
}
