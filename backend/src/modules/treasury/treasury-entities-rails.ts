import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../../database/entities/organization.entity';

/**
 * Rail connections (PRD §10): the customer's own wallet-provider / issuer
 * accounts. Credentials are stored as ciphertext references only — the
 * platform never persists a wallet key or PAN in plaintext (NFR-4, T9, T15).
 * The x402 adapter receives the (envelope-encrypted upstream) key per call.
 */
@Entity('treasury_rail_connections')
@Index(['org_id'])
@Unique(['org_id', 'rail', 'environment', 'provider'])
export class TreasuryRailConnection {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column() rail: 'manual' | 'x402' | 'card' | 'upi_uap';
  @Column() provider: string; // e.g. 'coinbase_cdp', 'manual'
  @Column({ default: 'sandbox' }) environment: 'sandbox' | 'live';
  @Column() display_name: string;
  /** KMS envelope-encrypted provider credential (never plaintext). */
  @Column({ type: 'bytea', nullable: true }) credentials_ciphertext: Buffer | null;
  @Column({ nullable: true }) credentials_kms_key_id: string | null;
  /** Non-secret connection config (networks, program refs). */
  @Column({ type: 'jsonb', default: '{}' }) config: Record<string, any>;
  @Column({ default: 'active' }) status: 'active' | 'disabled' | 'error';
  @CreateDateColumn() created_at: Date;
}

/**
 * Accounts/wallets discovered through a connection — read-only balances only
 * (FR-TRE-3). external_ref is a provider reference, never a card number.
 */
/**
 * DPoP replay table (T2): every accepted proof's nonce is recorded here.
 * Verification fails closed for: bad signature, stale timestamp (±5 min),
 * or a nonce seen before — a captured proof cannot be replayed.
 */
@Entity('treasury_proof_nonces')
@Index(['org_id'])
@Index(['agent_id', 'created_at'])
export class TreasuryProofNonce {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'uuid' }) agent_id: string;
  /** sha256(request_hash + ':' + proof) — replay detection key. */
  @Column({ unique: true }) nonce: string;
  @Column({ type: 'timestamptz' }) proof_ts: Date;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'org_id' }) organization: Organization;
  @CreateDateColumn() created_at: Date;
}

/**
 * Transactional outbox (NFR-6): treasury lifecycle events are committed in
 * the SAME transaction as the state change that caused them, then a poller
 * delivers them to subscribed webhooks with HMAC signatures. At-least-once
 * delivery; consumers dedupe on `event_id`.
 */
@Entity('treasury_webhook_outbox')
@Index(['org_id'])
@Index(['status', 'available_at'])
export class TreasuryWebhookOutbox {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  /** e.g. payment.settled, killswitch.engaged, budget.threshold_reached. */
  @Column() event_type: string;
  @Column('jsonb') payload: Record<string, any>;
  @Column({ default: 'pending' }) status: 'pending' | 'delivered' | 'failed';
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'int', default: 0 }) last_http_status: number;
  @Column({ nullable: true }) last_error: string | null;
  /** When an exception in the producer must not lose the event, the caller
   * passes the callback; here we record WHERE the event came from. */
  @Column({ nullable: true }) cause_id: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) available_at: Date;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() delivered_at: Date | null;
}

/**
 * Accounts/wallets discovered through a connection — read-only balances only
 * (FR-TRE-3). external_ref is a provider reference, never a card number.
 */
@Entity('treasury_payment_accounts')
@Index(['org_id'])
@Unique(['rail_connection_id', 'external_ref'])
export class TreasuryPaymentAccount {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'uuid' }) rail_connection_id: string;
  @Column({ type: 'uuid', nullable: true }) agent_id: string | null;
  @Column() kind: 'agent_wallet' | 'virtual_card_program' | 'bank_account' | 'upi_vpa';
  @Column() external_ref: string;
  @Column({ nullable: true }) asset_code: string | null;
  @Column({ nullable: true }) network: string | null;
  @Column({ type: 'bigint', nullable: true }) last_balance_minor: string | null;
  @Column({ type: 'timestamptz', nullable: true }) last_balance_at: Date | null;
  @Column({ type: 'jsonb', default: '{}' }) meta: Record<string, any>;
  @CreateDateColumn() created_at: Date;
}
