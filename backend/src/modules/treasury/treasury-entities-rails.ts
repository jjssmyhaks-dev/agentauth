import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

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
