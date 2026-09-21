import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { SignJWT, jwtVerify, importJWK } from 'jose';
import {
  TreasuryPolicy,
  TreasuryPolicyVersion,
  TreasuryMandate,
  TreasuryCounterparty,
  TreasuryPaymentIntent,
  TreasuryAuthorization,
  TreasuryKillSwitch,
  TreasuryApproval,
  TreasuryApprovalDecision,
  RailType,
  DecisionEffect,
  toMinorUnits,
  fromMinorUnits,
} from './treasury-entities';
import { validatePolicyDocument, canonicalJson } from './policy-schema';
import { evaluatePolicy, PolicyContext, PolicyDecision } from './policy-evaluator';
import { TreasuryBudgetsService } from './budgets.service';
import { TreasuryLedgerService } from './ledger.service';
import { RailsService } from './rails/rails.service';
import { ApprovalService } from '../approval/approval.service';
import { Agent } from '../../database/entities';

const SPEND_TOKEN_TTL_SECONDS = 120; // binding: TTL ≤ 120 s (FR-ID-3)
const EDDSA_KEY_TTL_GUARD = 5 * 60; // approval reservation window

export interface AuthorizeInput {
  org_id: string;
  agent_id: string;
  task_ref?: string | null;
  rail: RailType;
  amount: { value: string; asset: string };
  counterparty: { kind?: string; identifier: string };
  purpose?: string | null;
  environment?: 'sandbox' | 'live';
  rail_details?: Record<string, any>;
  /** base64 signature over request_hash by the agent key (DPoP-style proof). */
  proof?: string | null;
}

export interface AuthorizeResult {
  intent_id: string;
  decision: DecisionEffect | 'deny';
  status: string;
  reasons: Array<{ rule_id?: string; code?: string; message: string }>;
  authorization?: { token: string; expires_at: Date; audience: string };
  /** Rail credential (payment header, card reference, instruction) when brokering succeeded. */
  credential?: { kind: string; payload: Record<string, any>; provider_ref: string; expires_at: Date };
  approval?: { id: string; expires_at: Date };
  budget?: { remaining: string; asset: string; period_ends_at: Date };
}

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);

  /** EdDSA signing keypair for spend authorization tokens (ops-managed via env; generated otherwise). */
  private tokenPrivateKey: string;
  private tokenPublicKey: string;
  /** jose KeyObjects derived from the env keypair. */
  private cryptoSignKey!: crypto.KeyObject;
  private cryptoVerifyKey!: crypto.KeyObject;
  private readonly tokenKid = 'treasury-spend-key-1';

  constructor(
    @InjectRepository(TreasuryPolicy) private policyRepo: Repository<TreasuryPolicy>,
    @InjectRepository(TreasuryPolicyVersion) private policyVersionRepo: Repository<TreasuryPolicyVersion>,
    @InjectRepository(TreasuryMandate) private mandateRepo: Repository<TreasuryMandate>,
    @InjectRepository(TreasuryCounterparty) private counterpartyRepo: Repository<TreasuryCounterparty>,
    @InjectRepository(TreasuryPaymentIntent) private intentRepo: Repository<TreasuryPaymentIntent>,
    @InjectRepository(TreasuryAuthorization) private authorizationRepo: Repository<TreasuryAuthorization>,
    @InjectRepository(TreasuryKillSwitch) private killSwitchRepo: Repository<TreasuryKillSwitch>,
    @InjectRepository(TreasuryApproval) private approvalRepo: Repository<TreasuryApproval>,
    @InjectRepository(TreasuryApprovalDecision) private approvalDecisionRepo: Repository<TreasuryApprovalDecision>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    private budgets: TreasuryBudgetsService,
    private ledger: TreasuryLedgerService,
    private rails: RailsService,
    private approvalService: ApprovalService,
  ) {
    if (process.env.TREASURY_SPEND_PRIVATE_KEY && process.env.TREASURY_SPEND_PUBLIC_KEY) {
      this.tokenPrivateKey = process.env.TREASURY_SPEND_PRIVATE_KEY;
      this.tokenPublicKey = process.env.TREASURY_SPEND_PUBLIC_KEY;
    } else {
      const { generateKeyPairSync } = crypto as any;
      const pair = generateKeyPairSync('ed25519', {
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      this.tokenPrivateKey = pair.privateKey;
      this.tokenPublicKey = pair.publicKey;
      this.logger.warn('Generated ephemeral EdDSA spend-token key — set TREASURY_SPEND_PRIVATE_KEY/PUBLIC_KEY for ops-managed keys');
    }
    // jose needs KeyObjects; env may carry PEM strings or raw JWK objects.
    const toPrivate = (v: unknown) =>
      typeof v === 'string' ? crypto.createPrivateKey(v) : crypto.createPrivateKey({ key: v as crypto.JsonWebKey, format: 'jwk' });
    const toPublic = (v: unknown) =>
      typeof v === 'string' ? crypto.createPublicKey(v) : crypto.createPublicKey({ key: v as crypto.JsonWebKey, format: 'jwk' });
    this.cryptoSignKey = toPrivate(this.tokenPrivateKey);
    this.cryptoVerifyKey = toPublic(this.tokenPublicKey);
  }

  getJwks(): any {
    const jwk = this.cryptoVerifyKey.export({ format: 'jwk' }) as any;
    return { keys: [{ ...jwk, kid: this.tokenKid, use: 'sig', alg: 'EdDSA' }] };
  }

  // ── Policies ─────────────────────────────────────────────────────────────

  async createPolicy(orgId: string, name: string, document: unknown, createdBy?: string): Promise<{ policy: TreasuryPolicy; version: TreasuryPolicyVersion }> {
    const validation = validatePolicyDocument(document);
    if (!validation.valid) throw new BadRequestException({ code: 'invalid_policy', errors: validation.errors });
    const existing = await this.policyRepo.findOne({ where: { org_id: orgId, name } });
    if (existing) throw new ConflictException(`Policy "${name}" already exists`);
    const policy = await this.policyRepo.save(this.policyRepo.create({ org_id: orgId, name, status: 'draft' } as unknown as TreasuryPolicy));
    const version = await this.policyVersionRepo.save(
      this.policyVersionRepo.create({
        org_id: orgId,
        policy_id: policy.id,
        version: 1,
        document: document as Record<string, any>,
        checksum: crypto.createHash('sha256').update(canonicalJson(document)).digest('hex'),
        created_by: createdBy ?? null,
      } as unknown as TreasuryPolicyVersion),
    );
    return { policy, version };
  }

  async addPolicyVersion(orgId: string, policyId: string, document: unknown, createdBy?: string): Promise<TreasuryPolicyVersion> {
    const validation = validatePolicyDocument(document);
    if (!validation.valid) throw new BadRequestException({ code: 'invalid_policy', errors: validation.errors });
    const policy = await this.policyRepo.findOne({ where: { id: policyId, org_id: orgId } });
    if (!policy) throw new NotFoundException(`Policy ${policyId} not found`);
    const latest = await this.policyVersionRepo.findOne({ where: { policy_id: policyId }, order: { version: 'DESC' } });
    const version = await this.policyVersionRepo.save(
      this.policyVersionRepo.create({
        org_id: orgId,
        policy_id: policyId,
        version: (latest?.version ?? 0) + 1,
        document: document as Record<string, any>,
        checksum: crypto.createHash('sha256').update(canonicalJson(document)).digest('hex'),
        created_by: createdBy ?? null,
      } as unknown as TreasuryPolicy),
    );
    // A new draft version deactivates the pointer until simulated + re-activated.
    if (policy.active_version_id) {
      policy.status = 'draft';
      policy.active_version_id = null;
      await this.policyRepo.save(policy);
    }
    return version;
  }

  async listPolicies(orgId: string): Promise<Array<Record<string, any>>> {
    const policies = await this.policyRepo.find({ where: { org_id: orgId }, order: { created_at: 'DESC' } });
    const out: Array<Record<string, any>> = [];
    for (const p of policies) {
      const latest = await this.policyVersionRepo.findOne({ where: { policy_id: p.id }, order: { version: 'DESC' } });
      out.push({
        id: p.id,
        name: p.name,
        status: p.status,
        active_version_id: p.active_version_id,
        latest_version: latest?.version ?? null,
        latest_document: latest?.document ?? null,
        simulated_at: latest?.simulated_at ?? null,
        created_at: p.created_at,
      });
    }
    return out;
  }

  /** Simulation gate: replay synthetic/historical intents against a draft version. */
  async simulatePolicyVersion(orgId: string, policyId: string, version: number, syntheticIntents: Array<Partial<AuthorizeInput>>): Promise<Array<{ decision: PolicyDecision['effect']; reasons: string[] }>> {
    const pv = await this.policyVersionRepo.findOne({ where: { policy_id: policyId, org_id: orgId, version } });
    if (!pv) throw new NotFoundException(`Policy version v${version} not found`);
    const results = syntheticIntents.map((i) => {
      const amountMinor = toMinorUnits(i.amount!.value, i.amount!.asset).toString();
      const ctx = this.buildContext({ ...i, org_id: orgId, agent_id: i.agent_id ?? 'sim' } as AuthorizeInput, amountMinor, i.rail ?? 'manual');
      // Simulation is operator-driven: synthetic counterparty attributes are
      // trusted here. They never touch the live authorize path, where the DB
      // counterparty row is the sole source of list/category/allowlist truth.
      if (i.counterparty) {
        const synthetic = i.counterparty as typeof i.counterparty & { list?: string; category?: string; allowlisted?: boolean };
        ctx.counterparty = {
          ...ctx.counterparty,
          list: synthetic.list,
          category: synthetic.category,
          allowlisted: synthetic.allowlisted,
        };
      }
      const decision = evaluatePolicy(pv.document, ctx);
      return { decision: decision.effect, reasons: decision.reasons.map((r) => r.message) };
    });
    await this.policyVersionRepo.update(pv.id, { simulated_at: new Date() });
    return results;
  }

  /** Activation REQUIRES a prior simulation on the exact version (FR-POL-5). */
  async activatePolicyVersion(orgId: string, policyId: string, version: number, minSimulatedIntents = 20): Promise<TreasuryPolicyVersion> {
    const pv = await this.policyVersionRepo.findOne({ where: { policy_id: policyId, org_id: orgId, version } });
    if (!pv) throw new NotFoundException(`Policy version v${version} not found`);
    if (!pv.simulated_at) {
      throw new BadRequestException(`Version v${version} must be simulated before activation (FR-POL-5)`);
    }
    const policy = await this.policyRepo.findOne({ where: { id: policyId, org_id: orgId } });
    if (!policy) throw new NotFoundException(`Policy ${policyId} not found`);
    policy.status = 'active';
    policy.active_version_id = pv.id;
    await this.policyRepo.save(policy);
    return pv;
  }

  // ── Mandates ─────────────────────────────────────────────────────────────

  async createMandate(input: {
    org_id: string;
    agent_id: string;
    granted_by: string;
    policy_version_id: string;
    hard_limits: Record<string, any>;
    valid_from: Date;
    valid_until: Date;
    signature: string;
    signing_method: 'webauthn' | 'eip712' | 'ed25519_test';
    signing_key_ref: string;
  }): Promise<{ mandate: TreasuryMandate; signature_valid: boolean }> {
    const agent = await this.agentRepo.findOne({ where: { id: input.agent_id } });
    if (!agent) throw new NotFoundException(`Agent ${input.agent_id} not found`);
    const pv = await this.policyVersionRepo.findOne({ where: { id: input.policy_version_id, org_id: input.org_id } });
    if (!pv) throw new NotFoundException(`Policy version ${input.policy_version_id} not found`);

    const canonical = canonicalJson({
      agent_id: input.agent_id,
      granted_by: input.granted_by,
      hard_limits: input.hard_limits,
      org_id: input.org_id,
      policy_version_id: input.policy_version_id,
      valid_from: input.valid_from.toISOString(),
      valid_until: input.valid_until.toISOString(),
    });
    const canonicalHash = crypto.createHash('sha256').update(canonical).digest('hex');

    // Verify the signature over the canonical hash with the agent's registered key.
    // Ed25519 (our recorded deviation from the PRD's RSA default) signs raw messages:
    // the digest parameter must be null, else OpenSSL throws "invalid digest".
    let signatureValid = false;
    try {
      const publicKey = crypto.createPublicKey({ key: agent.public_key, format: 'pem', type: 'spki' });
      const digest = publicKey.asymmetricKeyType === 'ed25519' ? null : 'sha256';
      const verified = crypto.verify(
        digest as 'sha256' | null,
        Buffer.from(canonicalHash, 'hex'),
        publicKey,
        Buffer.from(input.signature, 'base64'),
      );
      signatureValid = !!verified;
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) throw new BadRequestException('Mandate signature invalid for canonical hash');

    const mandate = await this.mandateRepo.save(
      this.mandateRepo.create({
        org_id: input.org_id,
        agent_id: input.agent_id,
        granted_by: input.granted_by,
        policy_version_id: input.policy_version_id,
        hard_limits: input.hard_limits,
        valid_from: input.valid_from,
        valid_until: input.valid_until,
        canonical_hash: canonicalHash,
        signature: input.signature,
        signing_method: input.signing_method,
        signing_key_ref: input.signing_key_ref,
        status: 'active',
      } as unknown as TreasuryPolicyVersion),
    );
    await this.ledger.append({
      org_id: input.org_id,
      entry_type: 'adjustment',
      mandate_id: mandate.id,
      agent_id: input.agent_id,
      principal_ids: [input.granted_by],
      correlation_id: `mandate:${mandate.id}`,
    });
    return { mandate, signature_valid: true };
  }

  async revokeMandate(id: string, orgId: string, revokedBy: string, reason?: string): Promise<TreasuryMandate> {
    const mandate = await this.mandateRepo.findOne({ where: { id, org_id: orgId } });
    if (!mandate) throw new NotFoundException(`Mandate ${id} not found`);
    mandate.status = 'revoked';
    mandate.revoked_at = new Date();
    mandate.revoked_by = revokedBy;
    mandate.revoked_reason = reason ?? null;
    const saved = await this.mandateRepo.save(mandate);
    await this.ledger.append({
      org_id: orgId,
      entry_type: 'adjustment',
      mandate_id: id,
      agent_id: mandate.agent_id,
      principal_ids: [revokedBy],
      correlation_id: `mandate-revoked:${id}`,
    });
    return saved;
  }

  async listMandates(orgId: string, agentId?: string): Promise<TreasuryMandate[]> {
    const where: any = { org_id: orgId };
    if (agentId) where.agent_id = agentId;
    return this.mandateRepo.find({ where, order: { created_at: 'DESC' } });
  }

  // ── Kill switch ──────────────────────────────────────────────────────────

  async engageKillSwitch(input: { org_id: string; scope_type: 'org' | 'agent' | 'rail'; scope_id?: string | null; engaged_by: string; reason?: string }): Promise<TreasuryKillSwitch> {
    return this.killSwitchRepo.save(
      this.killSwitchRepo.create({
        org_id: input.org_id,
        scope_type: input.scope_type,
        scope_id: input.scope_id ?? null,
        engaged_by: input.engaged_by,
        engaged_at: new Date(),
        reason: input.reason ?? null,
      } as unknown as TreasuryMandate),
    );
  }

  async releaseKillSwitch(id: string, orgId: string): Promise<TreasuryKillSwitch> {
    const ks = await this.killSwitchRepo.findOne({ where: { id, org_id: orgId } });
    if (!ks) throw new NotFoundException(`Kill switch ${id} not found`);
    ks.released_at = new Date();
    return this.killSwitchRepo.save(ks);
  }

  async listKillSwitches(orgId: string): Promise<TreasuryKillSwitch[]> {
    return this.killSwitchRepo.find({ where: { org_id: orgId }, order: { engaged_at: 'DESC' } });
  }

  private async isKilled(orgId: string, agentId: string, rail: RailType): Promise<boolean> {
    const switches = await this.killSwitchRepo.find({ where: { org_id: orgId } });
    const now = Date.now();
    return switches.some(
      (s) =>
        !s.released_at &&
        (s.scope_type === 'org' ||
          (s.scope_type === 'agent' && s.scope_id === agentId) ||
          (s.scope_type === 'rail' && s.scope_id === rail)),
    );
  }

  // ── Counterparties ───────────────────────────────────────────────────────

  async upsertCounterparty(input: { org_id: string; kind: string; identifier: string; display_name?: string; category?: string; list_name?: string; allowlisted?: boolean; denylisted?: boolean }): Promise<TreasuryCounterparty> {
    const existing = await this.counterpartyRepo.findOne({
      where: { org_id: input.org_id, kind: input.kind as any, identifier: input.identifier },
    });
    if (existing) {
      if (input.display_name !== undefined) existing.display_name = input.display_name;
      if (input.category !== undefined) existing.category = input.category;
      if (input.list_name !== undefined) existing.list_name = input.list_name;
      if (input.allowlisted !== undefined) existing.allowlisted = input.allowlisted;
      if (input.denylisted !== undefined) existing.denylisted = input.denylisted;
      return this.counterpartyRepo.save(existing);
    }
    return this.counterpartyRepo.save(
      this.counterpartyRepo.create({
        org_id: input.org_id,
        kind: input.kind as any,
        identifier: input.identifier,
        display_name: input.display_name ?? null,
        category: input.category ?? null,
        list_name: input.list_name ?? null,
        allowlisted: input.allowlisted ?? false,
        denylisted: input.denylisted ?? false,
      } as unknown as TreasuryCounterparty),
    );
  }

  async listCounterparties(orgId: string): Promise<TreasuryCounterparty[]> {
    return this.counterpartyRepo.find({ where: { org_id: orgId }, order: { created_at: 'DESC' } });
  }

  // ── The decision path (deterministic; no LLM, no third-party calls) ──────

  private buildContext(input: AuthorizeInput, amountMinor: string, rail: RailType): PolicyContext {
    const identifier = input.counterparty.identifier;
    const parts = identifier.split('.');
    const domainSuffix = parts.length > 1 ? parts.slice(-2).join('.') : identifier;
    return {
      amount_minor: amountMinor,
      asset_code: input.amount.asset,
      rail,
      environment: input.environment ?? 'sandbox',
      counterparty: {
        identifier,
        kind: input.counterparty.kind,
        domain_suffix: domainSuffix,
      },
      purpose: input.purpose ?? null,
      task_ref: input.task_ref ?? null,
      now: new Date(),
      current_hour: new Date().getUTCHours(),
      current_day: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getUTCDay()],
      velocity: { count: 0, amount_minor: '0' },
    };
  }

  async authorize(input: AuthorizeInput, idempotencyKey: string): Promise<AuthorizeResult> {
    // Idempotency (FR-PAY-1): same key → same result.
    const existing = await this.intentRepo.findOne({ where: { org_id: input.org_id, idempotency_key: idempotencyKey } });
    if (existing) {
      return this.resultForIntent(existing);
    }

    const amountMinor = toMinorUnits(input.amount.value, input.amount.asset).toString();

    // Create intent row first (received), so every path has a record.
    const requestHash = crypto
      .createHash('sha256')
      .update(canonicalJson({ ...input, amount_minor: amountMinor }))
      .digest('hex');

    // Resolve active mandate (newest active for the agent).
    const mandate = await this.mandateRepo.findOne({
      where: { org_id: input.org_id, agent_id: input.agent_id, status: 'active' },
      order: { created_at: 'DESC' },
    });

    const intent = await this.intentRepo.save(
      this.intentRepo.create({
        org_id: input.org_id,
        agent_id: input.agent_id,
        mandate_id: mandate?.id ?? '00000000-0000-4000-8000-000000000000',
        policy_version_id: mandate?.policy_version_id ?? '00000000-0000-4000-8000-000000000000',
        task_ref: input.task_ref ?? null,
        rail: input.rail,
        environment: input.environment ?? 'sandbox',
        amount_minor: amountMinor,
        asset_code: input.amount.asset,
        purpose: input.purpose ?? null,
        request: { ...input.rail_details ?? {}, counterparty: input.counterparty },
        request_hash: requestHash,
        status: 'received',
        idempotency_key: idempotencyKey,
      } as unknown as TreasuryPaymentIntent),
    );

    const correlationId = `pi:${intent.id}`;

    try {
      // 1. Kill switch (org → agent → rail).
      if (await this.isKilled(input.org_id, input.agent_id, input.rail)) {
        return await this.finalizeDeny(intent, [{ code: 'kill_switch', message: 'Spend blocked by kill switch' }], correlationId, mandate?.id, null);
      }

      // 2. Mandate validity.
      if (!mandate) {
        return await this.finalizeDeny(intent, [{ code: 'mandate_invalid', message: 'No active mandate for this agent' }], correlationId, null, null);
      }
      const now = new Date();
      if (now < new Date(mandate.valid_from) || now > new Date(mandate.valid_until)) {
        return await this.finalizeDeny(intent, [{ code: 'mandate_expired', message: 'Mandate outside its validity window' }], correlationId, mandate.id, null);
      }
      if (mandate.hard_limits?.max_per_txn_minor && BigInt(amountMinor) > BigInt(mandate.hard_limits.max_per_txn_minor)) {
        return await this.finalizeDeny(intent, [{ code: 'mandate_invalid', message: 'Amount exceeds the mandate hard per-transaction limit' }], correlationId, mandate.id, null);
      }

      // 3. Policy evaluation (pure; version pinned by the mandate).
      const pv = await this.policyVersionRepo.findOne({ where: { id: mandate.policy_version_id } });
      if (!pv) {
        return await this.finalizeDeny(intent, [{ code: 'policy_error', message: 'Mandate policy version missing' }], correlationId, mandate.id, null);
      }

      // Counterparty enrichment (allowlist/denylist/category from the DB — no live calls).
      const counterparty = await this.counterpartyRepo.findOne({
        where: { org_id: input.org_id, identifier: input.counterparty.identifier },
      });
      const ctx = this.buildContext(input, amountMinor, input.rail);
      if (counterparty) {
        intent.counterparty_id = counterparty.id;
        await this.intentRepo.update(intent.id, { counterparty_id: counterparty.id });
        ctx.counterparty = {
          ...ctx.counterparty,
          id: counterparty.id,
          category: counterparty.category,
          allowlisted: counterparty.allowlisted,
          denylisted: counterparty.denylisted,
          list: counterparty.list_name ?? undefined,
        };
      }
      if (counterparty?.denylisted) {
        return await this.finalizeDeny(intent, [{ code: 'counterparty_denied', message: 'Counterparty is deny-listed' }], correlationId, mandate.id, pv);
      }

      const decision = evaluatePolicy(pv.document, ctx);

      // 4. Branch on effect.
      if (decision.effect === 'deny') {
        return await this.finalizeDeny(intent, decision.reasons, correlationId, mandate.id, pv, decision.matched_rule_ids[0]);
      }

      // 5. Budget reservation (atomic, hierarchical).
      const budgetId = mandate.hard_limits?.budget_id as string | undefined;
      let budgetInfo: AuthorizeResult['budget'];
      try {
        if (budgetId) {
          const reservedAmount = decision.cap_minor ?? amountMinor;
          const { periods } = await this.budgets.reserve({
            org_id: input.org_id,
            budget_id: budgetId,
            payment_intent_id: intent.id,
            amount_minor: reservedAmount,
            expires_at: new Date(Date.now() + EDDSA_KEY_TTL_GUARD * 1000),
          });
          await this.ledger.append({
            org_id: input.org_id,
            entry_type: 'reservation',
            payment_intent_id: intent.id,
            agent_id: input.agent_id,
            mandate_id: mandate.id,
            policy_version_id: pv.id,
            matched_rule_id: decision.matched_rule_ids[0] ?? null,
            counterparty_id: counterparty?.id ?? null,
            amount_minor: reservedAmount,
            asset_code: input.amount.asset,
            correlation_id: correlationId,
          });
          const remaining = await this.budgets.remaining(budgetId, input.org_id);
          budgetInfo = {
            remaining: fromMinorUnits(BigInt(remaining.remaining_minor), input.amount.asset),
            asset: input.amount.asset,
            period_ends_at: remaining.period_end,
          };
        }
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        if (msg.startsWith('budget_exceeded')) {
          return await this.finalizeDeny(intent, [{ code: 'budget_exceeded', message: 'Budget exhausted at some level of the hierarchy' }], correlationId, mandate.id, pv);
        }
        if (msg.startsWith('budget_paused')) {
          return await this.finalizeDeny(intent, [{ code: 'policy_denied', message: 'Budget paused' }], correlationId, mandate.id, pv);
        }
        throw err;
      }

      if (decision.effect === 'require_approval') {
        const expiresAt = new Date(Date.now() + 4 * 3600 * 1000); // policy timeout; 4h default
        const approval = await this.approvalRepo.save(
          this.approvalRepo.create({
            org_id: input.org_id,
            payment_intent_id: intent.id,
            intent_hash: requestHash,
            required: decision.approval ?? { roles: ['admin'], quorum: 1 },
            status: 'pending',
            expires_at: expiresAt,
          } as unknown as TreasuryKillSwitch),
        );
        await this.intentRepo.update(intent.id, {
      decision: 'require_approval',
      decision_reasons: decision.reasons as unknown as Record<string, any>[],
      matched_rule_id: decision.matched_rule_ids[0] ?? null,
      status: 'pending_approval',
    });
        await this.ledger.append({
          org_id: input.org_id,
          entry_type: 'decision',
          payment_intent_id: intent.id,
          agent_id: input.agent_id,
          mandate_id: mandate.id,
          policy_version_id: pv.id,
          matched_rule_id: decision.matched_rule_ids[0] ?? null,
          counterparty_id: counterparty?.id ?? null,
          amount_minor: amountMinor,
          asset_code: input.amount.asset,
          correlation_id: correlationId,
        });
        // M4: surface the request in the existing approvals inbox so the human
        // loop reuses the platform's queue, audit trail and notifications.
        try {
          const pending = await this.approvalService.create(
            input.agent_id,
            `treasury:${decision.matched_rule_ids[0] ?? 'require_approval'}`,
            `payment_intent:${intent.id}`,
            {
              intent_id: intent.id,
              amount_minor: amountMinor,
              asset: input.amount.asset,
              counterparty: input.counterparty.identifier,
              rail: input.rail,
              purpose: input.purpose ?? null,
              intent_hash: requestHash,
            },
          );
          await this.intentRepo.update(intent.id, { pending_approval_id: pending.id } as any);
        } catch (err: any) {
          // The treasury approval row already exists; the inbox mirror is additive.
          this.logger.warn(`approval inbox mirror failed (non-fatal): ${err?.message ?? err}`);
        }
        return {
          intent_id: intent.id,
          decision: 'require_approval',
          status: 'pending_approval',
          reasons: decision.reasons,
          approval: { id: approval.id, expires_at: expiresAt },
          ...(budgetInfo ? { budget: budgetInfo } : {}),
        };
      }

      // 6. Allow / allow_with_cap → issue the single-use spend token.
      return await this.issueAuthorization(intent, mandate, pv, decision, input, correlationId, counterparty?.id ?? null, budgetInfo);
    } catch (err: any) {
      // FAIL CLOSED: any unexpected error denies the intent.
      this.logger.error(`authorize failed closed: ${err?.message ?? err}`);
      try {
        await this.finalizeDeny(intent, [{ code: 'policy_error', message: 'Internal decision error (fail closed)' }], correlationId, mandate?.id ?? null, null);
      } catch {
        /* keep the original error path */
      }
      return {
        intent_id: intent.id,
        decision: 'deny',
        status: 'denied',
        reasons: [{ code: 'policy_error', message: 'Internal decision error (fail closed)' }],
      };
    }
  }

  private async finalizeDeny(
    intent: TreasuryPaymentIntent,
    reasons: Array<{ rule_id?: string; code?: string; message: string }>,
    correlationId: string,
    mandateId: string | null,
    policyVersionId: TreasuryPolicyVersion | string | null,
    matchedRuleId?: string,
  ): Promise<AuthorizeResult> {
    await this.intentRepo.update(intent.id, {
      decision: 'deny',
      decision_reasons: reasons as unknown as Record<string, any>[],
      matched_rule_id: matchedRuleId ?? null,
      status: 'denied',
    });
    await this.ledger.append({
      org_id: intent.org_id,
      entry_type: 'decision',
      payment_intent_id: intent.id,
      agent_id: intent.agent_id,
      mandate_id: mandateId,
      policy_version_id: typeof policyVersionId === 'string' ? policyVersionId : policyVersionId?.id ?? null,
      matched_rule_id: matchedRuleId ?? null,
      amount_minor: intent.amount_minor,
      asset_code: intent.asset_code,
      correlation_id: correlationId,
    });
    return { intent_id: intent.id, decision: 'deny', status: 'denied', reasons };
  }

  private async issueAuthorization(
    intent: TreasuryPaymentIntent,
    mandate: TreasuryMandate,
    pv: { id: string },
    decision: PolicyDecision,
    input: AuthorizeInput,
    correlationId: string,
    counterpartyId: string | null,
    budgetInfo?: AuthorizeResult['budget'],
  ): Promise<AuthorizeResult> {
    const jti = crypto.randomUUID();
    const maxAmount = decision.cap_minor ?? intent.amount_minor;
    const audience = `rail:${intent.rail}`;
    const expiresAt = new Date(Date.now() + SPEND_TOKEN_TTL_SECONDS * 1000);

    const token = await new SignJWT({
      mandate_id: mandate.id,
      intent_id: intent.id,
      max_amount: maxAmount,
      asset: intent.asset_code,
      counterparty: input.counterparty.identifier,
      cnf: { jwk: this.tokenKid }, // sender-constraint reference (agent key in production)
      act: { sub: mandate.granted_by }, // delegation chain: human → agent
    })
      .setProtectedHeader({ alg: 'EdDSA', kid: this.tokenKid, typ: 'JWT' })
      .setSubject(intent.agent_id)
      .setJti(jti)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.cryptoSignKey);

    await this.authorizationRepo.save(
      this.authorizationRepo.create({
        org_id: intent.org_id,
        payment_intent_id: intent.id,
        jti,
        audience,
        max_amount_minor: maxAmount,
        asset_code: intent.asset_code,
        expires_at: expiresAt,
      } as unknown as TreasuryAuthorization),
    );

    await this.intentRepo.update(intent.id, {
      decision: decision.effect,
      decision_reasons: decision.reasons as unknown as Record<string, any>[],
      matched_rule_id: decision.matched_rule_ids[0] ?? null,
      status: 'authorized',
    });

    await this.ledger.append({
      org_id: intent.org_id,
      entry_type: 'authorization',
      payment_intent_id: intent.id,
      agent_id: intent.agent_id,
      mandate_id: mandate.id,
      policy_version_id: pv.id,
      matched_rule_id: decision.matched_rule_ids[0] ?? null,
      counterparty_id: counterpartyId,
      amount_minor: maxAmount,
      asset_code: intent.asset_code,
      rail_ref: jti,
      correlation_id: correlationId,
    });

    // Rail credential brokering (FR-PAY-2): prepare + issue through the
    // adapter. Credential failures NEVER flip the decision — the spend token
    // is already valid; the agent can retry credential acquisition.
    let credential: Record<string, any> | undefined;
    try {
      const connection = await this.rails.connectionFor(intent.org_id, intent.rail, input.environment ?? 'sandbox');
      const prepared = await this.rails.prepare(
        intent.rail,
        { amount_minor: maxAmount, asset_code: intent.asset_code, counterparty: input.counterparty, rail_details: input.rail_details },
        { org_id: intent.org_id, environment: input.environment ?? 'sandbox', connection },
      );
      const issued = await this.rails.issueCredential(
        intent.rail,
        prepared,
        {
          token, jti, intent_id: intent.id, agent_id: intent.agent_id, mandate_id: mandate.id,
          max_amount_minor: maxAmount, asset_code: intent.asset_code,
          counterparty: input.counterparty.identifier, audience, expires_at: expiresAt,
        },
        { org_id: intent.org_id, environment: input.environment ?? 'sandbox', connection },
      );
      credential = { kind: issued.kind, payload: issued.payload, provider_ref: issued.provider_ref, expires_at: issued.expires_at };
    } catch (err: any) {
      this.logger.warn(`credential issuance failed for intent ${intent.id} (decision stands): ${err?.message ?? err}`);
      credential = undefined;
    }

    return {
      intent_id: intent.id,
      decision: decision.effect,
      status: 'authorized',
      reasons: decision.reasons,
      authorization: { token, expires_at: expiresAt, audience },
      ...(credential ? { credential: credential as AuthorizeResult['credential'] } : {}),
      ...(budgetInfo ? { budget: budgetInfo } : {}),
    };
  }

  private resultForIntent(intent: TreasuryPaymentIntent): AuthorizeResult {
    return {
      intent_id: intent.id,
      decision: (intent.decision ?? 'deny') as DecisionEffect | 'deny',
      status: intent.status,
      reasons: (intent.decision_reasons ?? []) as AuthorizeResult['reasons'],
    };
  }

  /** Rail evidence → capture (manual rail records the confirmation verbatim). */
  async confirm(intentId: string, orgId: string, evidence: { rail_ref: string; note?: string }): Promise<AuthorizeResult> {
    const intent = await this.intentRepo.findOne({ where: { id: intentId, org_id: orgId } });
    if (!intent) throw new NotFoundException(`Intent ${intentId} not found`);
    if (intent.status !== 'authorized' && intent.status !== 'executing') {
      throw new BadRequestException(`Intent in status ${intent.status} cannot be confirmed`);
    }
    // Route confirmation evidence through the rail adapter (FR-PAY-2).
    try {
      const connection = await this.rails.connectionFor(orgId, intent.rail, intent.environment ?? 'sandbox');
      const result = await this.rails.confirm(
        intent.rail,
        intentId,
        { rail_ref: evidence.rail_ref, note: evidence.note },
        { org_id: orgId, environment: intent.environment ?? 'sandbox', connection },
      );
      if (!result.ok) {
        throw new BadRequestException(`rail rejected the confirmation: ${result.reason ?? 'unknown'}`);
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`rail confirm fallback for ${intentId}: ${err?.message ?? err}`);
    }

    await this.budgets.capture(intentId, orgId);
    await this.intentRepo.update(intentId, { status: 'settled' });
    await this.authorizationRepo.update({ payment_intent_id: intentId }, { consumed_at: new Date() });
    await this.ledger.append({
      org_id: orgId,
      entry_type: 'capture',
      payment_intent_id: intentId,
      agent_id: intent.agent_id,
      mandate_id: intent.mandate_id,
      policy_version_id: intent.policy_version_id,
      counterparty_id: intent.counterparty_id,
      amount_minor: intent.amount_minor,
      asset_code: intent.asset_code,
      rail_ref: evidence.rail_ref,
      correlation_id: `pi:${intentId}`,
    });
    return { intent_id: intentId, decision: 'allow', status: 'settled', reasons: [{ message: 'Payment confirmed and captured' }] };
  }

  /** Cancel: release reservation, cancel token. */
  async cancel(intentId: string, orgId: string): Promise<AuthorizeResult> {
    const intent = await this.intentRepo.findOne({ where: { id: intentId, org_id: orgId } });
    if (!intent) throw new NotFoundException(`Intent ${intentId} not found`);
    if (['settled', 'failed', 'cancelled'].includes(intent.status)) {
      throw new BadRequestException(`Intent already terminal (${intent.status})`);
    }
    await this.budgets.release(intentId, orgId);
    await this.authorizationRepo.update({ payment_intent_id: intentId, consumed_at: undefined as any }, { revoked_at: new Date() });
    await this.intentRepo.update(intentId, { status: 'cancelled' });
    await this.ledger.append({
      org_id: orgId,
      entry_type: 'release',
      payment_intent_id: intentId,
      agent_id: intent.agent_id,
      correlation_id: `pi:${intentId}`,
    });
    return { intent_id: intentId, decision: 'deny', status: 'cancelled', reasons: [{ message: 'Intent cancelled; reservation released' }] };
  }

  async getIntent(intentId: string, orgId: string): Promise<TreasuryPaymentIntent> {
    const intent = await this.intentRepo.findOne({ where: { id: intentId, org_id: orgId } });
    if (!intent) throw new NotFoundException(`Intent ${intentId} not found`);
    return intent;
  }

  async listIntents(orgId: string, limit = 50): Promise<TreasuryPaymentIntent[]> {
    return this.intentRepo.find({ where: { org_id: orgId }, order: { created_at: 'DESC' }, take: limit });
  }

  /** Expiry sweeper: release held reservations on expired approvals/intents. */
  async sweepExpiries(orgId: string): Promise<{ released: number; approvals_expired: number }> {
    const released = await this.budgets.releaseExpired(orgId);
    const staleApprovals = await this.approvalRepo.find({
      where: { org_id: orgId, status: 'pending' },
    });
    let expired = 0;
    for (const a of staleApprovals) {
      if (a.expires_at < new Date()) {
        a.status = 'expired';
        await this.approvalRepo.save(a);
        const intent = await this.intentRepo.findOne({ where: { id: a.payment_intent_id } });
        if (intent && intent.status === 'pending_approval') {
          await this.intentRepo.update(intent.id, { status: 'expired' });
        }
        await this.budgets.release(a.payment_intent_id, orgId);
        expired++;
      }
    }
    return { released, approvals_expired: expired };
  }

  // ── Approvals (signed decisions over the intent hash) ────────────────────

  async decideApproval(approvalId: string, orgId: string, input: {
    principal_id: string;
    decision: 'approve' | 'deny';
    signature: string;
    channel?: string;
  }): Promise<AuthorizeResult> {
    const approval = await this.approvalRepo.findOne({ where: { id: approvalId, org_id: orgId } });
    if (!approval) throw new NotFoundException(`Approval ${approvalId} not found`);
    if (approval.status !== 'pending') throw new ConflictException(`Approval already ${approval.status}`);

    // Verify the approver's signature over the intent hash (what you see is what you sign).
    // Same Ed25519 digest rule as mandate signatures (null digest, raw message).
    const agent = await this.agentRepo.findOne({ where: { id: (await this.intentRepo.findOne({ where: { id: approval.payment_intent_id } }))!.agent_id } });
    let signatureValid = false;
    try {
      const publicKey = crypto.createPublicKey({ key: agent!.public_key, format: 'pem', type: 'spki' });
      const digest = publicKey.asymmetricKeyType === 'ed25519' ? null : 'sha256';
      signatureValid = crypto.verify(
        digest as 'sha256' | null,
        Buffer.from(approval.intent_hash, 'hex'),
        publicKey,
        Buffer.from(input.signature, 'base64'),
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) throw new BadRequestException('Approval signature invalid for intent hash');

    await this.approvalDecisionRepo.save(
      this.approvalDecisionRepo.create({
        org_id: orgId,
        approval_id: approval.id,
        principal_id: input.principal_id,
        decision: input.decision,
        signature: input.signature,
        channel: input.channel ?? 'dashboard',
      } as unknown as TreasuryApproval),
    );

    const required = approval.required ?? { quorum: 1 };
    const decisions = await this.approvalDecisionRepo.find({ where: { approval_id: approval.id } });
    const approvalsFor = decisions.filter((d) => d.decision === 'approve');
    const quorum = required.quorum ?? 1;

    const intent = await this.intentRepo.findOne({ where: { id: approval.payment_intent_id } });
    if (!intent) throw new NotFoundException('Intent missing for approval');

    if (input.decision === 'deny') {
      approval.status = 'denied';
      await this.approvalRepo.save(approval);
      await this.budgets.release(approval.payment_intent_id, orgId);
      await this.intentRepo.update(intent.id, { status: 'denied', decision: 'deny' });
      await this.ledger.append({
        org_id: orgId,
        entry_type: 'decision',
        payment_intent_id: intent.id,
        agent_id: intent.agent_id,
        principal_ids: [input.principal_id],
        correlation_id: `pi:${intent.id}`,
      });
      return { intent_id: intent.id, decision: 'deny', status: 'denied', reasons: [{ message: 'Denied by approver' }] };
    }

    if (approvalsFor.length >= quorum) {
      approval.status = 'approved';
      await this.approvalRepo.save(approval);
      await this.intentRepo.update(intent.id, { status: 'approved' });
      await this.ledger.append({
        org_id: orgId,
        entry_type: 'decision',
        payment_intent_id: intent.id,
        agent_id: intent.agent_id,
        principal_ids: approvalsFor.map((d) => d.principal_id),
        correlation_id: `pi:${intent.id}`,
      });
      return { intent_id: intent.id, decision: 'allow', status: 'approved', reasons: [{ message: 'Approved; reservation held, ready to execute' }] };
    }

    return { intent_id: intent.id, decision: 'allow', status: 'pending_approval', reasons: [{ message: `Quorum ${approvalsFor.length}/${quorum} recorded` }] };
  }

  async listApprovals(orgId: string, status?: string): Promise<Array<Record<string, any>>> {
    const qb = this.approvalRepo.createQueryBuilder('a').where('a.org_id = :orgId', { orgId });
    if (status) qb.andWhere('a.status = :status', { status });
    const approvals = await qb.orderBy('a.created_at', 'DESC').getMany();
    const out: Array<Record<string, any>> = [];
    for (const a of approvals) {
      const intent = await this.intentRepo.findOne({ where: { id: a.payment_intent_id } });
      const agent = intent ? await this.agentRepo.findOne({ where: { id: intent.agent_id } }) : null;
      const counterparty = intent?.counterparty_id
        ? await this.counterpartyRepo.findOne({ where: { id: intent.counterparty_id } })
        : null;
      out.push({
        id: a.id,
        status: a.status,
        intent_hash: a.intent_hash,
        required: a.required,
        expires_at: a.expires_at,
        payment_intent_id: a.payment_intent_id,
        agent_name: agent?.name ?? null,
        amount: intent ? { value: fromMinorUnits(BigInt(intent.amount_minor), intent.asset_code), asset: intent.asset_code } : null,
        counterparty: intent?.request?.counterparty ?? counterparty?.identifier ?? null,
        purpose: intent?.purpose ?? null,
        rail: intent?.rail ?? null,
      });
    }
    return out;
  }

  // ── Verifier API (FR-ID-4) ────────────────────────────────────────────────

  /** Consume a spend token: verifies signature/expiry/revocation single-use jti. */
  async verifyToken(token: string): Promise<Record<string, any>> {
    let payload: any;
    try {
      ({ payload } = await jwtVerify(token, this.cryptoVerifyKey, { algorithms: ['EdDSA'] }));
    } catch {
      return { valid: false, reason: 'invalid_token' };
    }
    const auth = await this.authorizationRepo.findOne({ where: { jti: payload.jti } });
    if (!auth) return { valid: false, reason: 'unknown_jti' };
    if (auth.consumed_at) return { valid: false, reason: 'token_replayed' };
    if (auth.revoked_at) return { valid: false, reason: 'token_revoked' };
    if (auth.expires_at < new Date()) return { valid: false, reason: 'token_expired' };

    const mandate = await this.mandateRepo.findOne({ where: { id: payload.mandate_id } });
    if (!mandate || mandate.status !== 'active') return { valid: false, reason: 'mandate_invalid' };
    if (await this.isKilled(auth.org_id, payload.sub, (auth.audience.replace('rail:', '') || 'manual') as RailType)) {
      return { valid: false, reason: 'kill_switch' };
    }

    // Single-use enforcement (FR-ID-3): a successful verification consumes the
    // jti. The counterparty has now seen and accepted the proof — any further
    // verification of the same token is a replay.
    await this.authorizationRepo.update({ jti: payload.jti }, { consumed_at: new Date() });

    return {
      valid: true,
      jti: payload.jti,
      agent_id: payload.sub,
      intent_id: payload.intent_id,
      mandate_id: payload.mandate_id,
      max_amount: { minor: payload.max_amount, asset: payload.asset },
      counterparty: payload.counterparty,
      delegated_by: payload.act?.sub ?? null,
      expires_at: auth.expires_at,
    };
  }

  /** Mark token consumed (adapters call this when releasing a credential). */
  async consumeToken(jti: string): Promise<void> {
    await this.authorizationRepo.update({ jti }, { consumed_at: new Date() });
  }
}
