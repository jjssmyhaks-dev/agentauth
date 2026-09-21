/**
 * Rail adapter interface (PRD §9.4, FR-PAY-2).
 *
 * Rails are pluggable: a new adapter can be added without touching the policy
 * engine, the budget service or the ledger. The platform is non-custodial —
 * wallet/card providers are the customer's own accounts; the platform only
 * brokers credentials and records outcomes (§9.6).
 */

export type RailType = 'manual' | 'x402' | 'card' | 'upi_uap';

/** The single-use spend token the decision path issued for this payment. */
export interface SpendAuthorization {
  token: string;
  jti: string;
  intent_id: string;
  agent_id: string;
  mandate_id: string;
  max_amount_minor: string;
  asset_code: string;
  counterparty: string;
  audience: string;
  expires_at: Date;
}

export interface AdapterContext {
  org_id: string;
  environment: 'sandbox' | 'live';
  /** Decrypted rail-connection config (provider name, scoped credentials). */
  connection: {
    provider: string;
    config: Record<string, any>;
  };
}

/** Normalized counterparty + amount after rail-specific validation. */
export interface PreparedPayment {
  rail: RailType;
  counterparty: { kind?: string; identifier: string };
  amount_minor: string;
  asset_code: string;
  /** Rail-specific normalized fields (network, pay_to, merchant id…). */
  details: Record<string, any>;
}

/** The credential/instruction an agent executes with (never a PAN). */
export interface Credential {
  kind: 'spend_token' | 'payment_header' | 'card_reference' | 'instruction';
  /** Opaque payload the agent runtime uses on the rail. */
  payload: Record<string, any>;
  /** Issuer/provider reference stored in the ledger — never card data. */
  provider_ref: string;
  expires_at: Date;
}

export interface RailEvidence {
  /** Receipt id, tx hash, or issuer reference. */
  rail_ref: string;
  note?: string;
}

export interface ConfirmationResult {
  ok: boolean;
  settled: boolean;
  provider_ref?: string;
  reason?: string;
}

export interface TimeWindow {
  from: Date;
  to: Date;
}

export interface ReconciliationReport {
  checked: number;
  matched: number;
  mismatches: Array<{ intent_id: string; reason: string }>;
}

export interface RailAdapter {
  readonly rail: RailType;

  capabilities(): {
    platformExecutes: boolean;
    supportsRefund: boolean;
    assets: string[];
  };

  /** Validate rail-specific fields; return the normalized counterparty + amount. */
  prepare(intent: {
    amount_minor: string;
    asset_code: string;
    counterparty: { kind?: string; identifier: string };
    rail_details?: Record<string, any>;
  }, ctx: AdapterContext): Promise<PreparedPayment>;

  /** Produce the credential/instruction. Adapters MUST call assertNotRevoked first. */
  issueCredential(prepared: PreparedPayment, auth: SpendAuthorization, ctx: AdapterContext): Promise<Credential>;

  /** Called with rail evidence (receipt, tx hash, issuer webhook). */
  confirm(intentId: string, evidence: RailEvidence, ctx: AdapterContext): Promise<ConfirmationResult>;

  /** Compare ledger entries to rail records for a time window (FR-PAY-9). */
  reconcile(entries: Array<{ intent_id: string; amount_minor: string; asset_code: string; rail_ref: string | null }>, window: TimeWindow, ctx: AdapterContext): Promise<ReconciliationReport>;

  /** Check the revocation list before releasing any credential (FR-POL-8). */
  assertNotRevoked(auth: SpendAuthorization, status: { revoked_at: Date | null; consumed_at: Date | null; expires_at: Date }): Promise<void>;

  refund?(intentId: string, amountMinor: string, ctx: AdapterContext): Promise<{ ok: boolean; provider_ref?: string; reason?: string }>;
}
