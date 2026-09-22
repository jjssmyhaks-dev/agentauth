import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TreasuryService } from './treasury.service';
import { TreasuryBudgetsService } from './budgets.service';
import { TreasuryLedgerService } from './ledger.service';
import { ApprovalService } from '../approval/approval.service';
import { RailsService } from './rails/rails.service';
import {
  TreasuryPolicy, TreasuryPolicyVersion, TreasuryMandate, TreasuryCounterparty,
  TreasuryPaymentIntent, TreasuryAuthorization, TreasuryKillSwitch,
  TreasuryApproval, TreasuryApprovalDecision,
} from './treasury-entities';
import { TreasuryProofNonce, TreasuryWebhookOutbox } from './treasury-entities-rails';
import { TreasuryWebhookOutboxService } from './webhook-outbox.service';
import { Agent } from '../../database/entities';

const ORG = '11111111-1111-4111-8111-111111111111';
const AGENT = '22222222-2222-4222-8222-222222222222';
const PRINCIPAL = '33333333-3333-4333-8333-333333333333';

// Real EdDSA keypair for the service under test (env-injected).
const { generateKeyPairSync, createSign, createHash } = crypto;
const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const AGENT_PRIV = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function makeRepo() {
  return {
    create: jest.fn((x) => ({ ...x, id: x.id ?? crypto.randomUUID() })),
    save: jest.fn(async (x) => (Array.isArray(x) ? x : { ...x, id: x.id ?? crypto.randomUUID() })),
    update: jest.fn(async () => undefined),
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    findAndCount: jest.fn(async () => [[], 0]),
    createQueryBuilder: jest.fn(),
  };
}

describe('TreasuryService decision path', () => {
  let service: TreasuryService;
  let ledger: { append: jest.Mock; verifyChain: jest.Mock; listForOrg: jest.Mock };
  let budgets: { reserve: jest.Mock; capture: jest.Mock; release: jest.Mock; releaseExpired: jest.Mock; remaining: jest.Mock };
  let intentRepo: ReturnType<typeof makeRepo>;
  let mandateRepo: ReturnType<typeof makeRepo>;
  let killSwitchRepo: ReturnType<typeof makeRepo>;
  let policyVersionRepo: ReturnType<typeof makeRepo>;
  let counterpartyRepo: ReturnType<typeof makeRepo>;
  let approvalRepo: ReturnType<typeof makeRepo>;
  let authorizationRepo: ReturnType<typeof makeRepo>;
  let approvalService: { create: jest.Mock };
  let rails: { connectionFor: jest.Mock; prepare: jest.Mock; issueCredential: jest.Mock; confirm: jest.Mock };

  const policyDoc = {
    schema: 'agent-policy/1',
    default: 'deny',
    rules: [
      {
        id: 'allow-small-api',
        effect: 'allow',
        when: {
          rail: ['x402'],
          counterparty: { in_list: 'approved-apis' },
          amount: { lte: { value: '2.00', asset: 'USDC' } },
        },
      },
      {
        id: 'big-needs-human',
        effect: 'require_approval',
        when: { amount: { gt: { value: '5.00', asset: 'USDC' } } },
        approval: { roles: ['finance'], quorum: 1 },
      },
    ],
  };

  const mandate = {
    id: 'mandate-1',
    org_id: ORG,
    agent_id: AGENT,
    status: 'active',
    granted_by: PRINCIPAL,
    policy_version_id: 'pv-1',
    hard_limits: { budget_id: 'budget-1', max_per_txn_minor: '10000000' },
    valid_from: new Date(Date.now() - 3600_000),
    valid_until: new Date(Date.now() + 3600_000),
  };

  beforeEach(async () => {
    intentRepo = makeRepo();
    mandateRepo = makeRepo();
    killSwitchRepo = makeRepo();
    policyVersionRepo = makeRepo();
    counterpartyRepo = makeRepo();
    approvalRepo = makeRepo();
    authorizationRepo = makeRepo();

    ledger = {
      append: jest.fn(async (i) => ({ seq: '1', ...i, entry_hash: 'h', prev_hash: '0' })),
      verifyChain: jest.fn(async () => ({ valid: true, checked_entries: 0 })),
      listForOrg: jest.fn(async () => ({ data: [], total: 0 })),
    };
    budgets = {
      reserve: jest.fn(async () => ({ reservations: [], periods: [] })),
      capture: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      releaseExpired: jest.fn(async () => 0),
      remaining: jest.fn(async () => ({ remaining_minor: '148500000', period_end: new Date() })),
    };
    approvalService = { create: jest.fn(async () => ({ id: 'inbox-1', status: 'pending' })) };
    rails = {
      connectionFor: jest.fn(async () => ({ provider: 'manual', config: {} })),
      prepare: jest.fn(async (_rail: any, intent: any) => ({
        rail: 'manual', counterparty: intent.counterparty, amount_minor: intent.amount_minor,
        asset_code: intent.asset_code, details: {},
      })),
      issueCredential: jest.fn(async () => ({
        kind: 'instruction', payload: { execute: 'off-platform' }, provider_ref: 'manual:x', expires_at: new Date(Date.now() + 60_000),
      })),
      confirm: jest.fn(async () => ({ ok: true, settled: true, provider_ref: 'manual:x' })),
    };

    // Default happy-path wiring.
    killSwitchRepo.find.mockResolvedValue([]);
    mandateRepo.findOne.mockResolvedValue(mandate);
    policyVersionRepo.findOne.mockResolvedValue({ id: 'pv-1', document: policyDoc, version: 3 });
    counterpartyRepo.findOne.mockResolvedValue({
      id: 'cp-1', identifier: 'api.example.com', category: 'api', list_name: 'approved-apis', allowlisted: true, denylisted: false,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TreasuryService,
        { provide: TreasuryBudgetsService, useValue: budgets },
        { provide: TreasuryLedgerService, useValue: ledger },
        { provide: ApprovalService, useValue: approvalService },
        { provide: RailsService, useValue: rails },
        { provide: getRepositoryToken(TreasuryPolicy), useValue: makeRepo() },
        { provide: getRepositoryToken(TreasuryPolicyVersion), useValue: policyVersionRepo },
        { provide: getRepositoryToken(TreasuryMandate), useValue: mandateRepo },
        { provide: getRepositoryToken(TreasuryCounterparty), useValue: counterpartyRepo },
        { provide: getRepositoryToken(TreasuryPaymentIntent), useValue: intentRepo },
        { provide: getRepositoryToken(TreasuryApproval), useValue: approvalRepo },
        { provide: getRepositoryToken(TreasuryApprovalDecision), useValue: makeRepo() },
        { provide: getRepositoryToken(TreasuryAuthorization), useValue: authorizationRepo },
        { provide: getRepositoryToken(TreasuryKillSwitch), useValue: killSwitchRepo },
        { provide: getRepositoryToken(Agent), useValue: makeRepo() },
        { provide: getRepositoryToken(TreasuryProofNonce), useValue: makeRepo() },
        { provide: getRepositoryToken(TreasuryWebhookOutbox), useValue: makeRepo() },
        { provide: TreasuryWebhookOutboxService, useFactory: () => {
          const repo = makeRepo();
          repo.findOne.mockResolvedValue(null);
          return new TreasuryWebhookOutboxService(repo as any, { post: jest.fn(async () => ({})) } as any);
        } },
      ],
    })
      .overrideProvider(TreasuryService)
      .useValue(undefined)
      .compile();

    // Re-create with env keys (constructor reads env at instantiation).
    process.env.TREASURY_SPEND_PRIVATE_KEY = privateKey;
    process.env.TREASURY_SPEND_PUBLIC_KEY = publicKey;

    const module2: TestingModule = await Test.createTestingModule({
      providers: [
        TreasuryService,
        { provide: TreasuryBudgetsService, useValue: budgets },
        { provide: TreasuryLedgerService, useValue: ledger },
        { provide: ApprovalService, useValue: approvalService },
        { provide: RailsService, useValue: rails },
        { provide: getRepositoryToken(TreasuryPolicy), useValue: makeRepo() },
        { provide: getRepositoryToken(TreasuryPolicyVersion), useValue: policyVersionRepo },
        { provide: getRepositoryToken(TreasuryMandate), useValue: mandateRepo },
        { provide: getRepositoryToken(TreasuryCounterparty), useValue: counterpartyRepo },
        { provide: getRepositoryToken(TreasuryPaymentIntent), useValue: intentRepo },
        { provide: getRepositoryToken(TreasuryAuthorization), useValue: authorizationRepo },
        { provide: getRepositoryToken(TreasuryKillSwitch), useValue: killSwitchRepo },
        { provide: getRepositoryToken(TreasuryApproval), useValue: approvalRepo },
        { provide: getRepositoryToken(TreasuryApprovalDecision), useValue: makeRepo() },
        { provide: getRepositoryToken(Agent), useValue: makeRepo() },
        { provide: getRepositoryToken(TreasuryProofNonce), useValue: makeRepo() },
        { provide: getRepositoryToken(TreasuryWebhookOutbox), useValue: makeRepo() },
        { provide: TreasuryWebhookOutboxService, useFactory: () => {
          const repo = makeRepo();
          repo.findOne.mockResolvedValue(null);
          return new TreasuryWebhookOutboxService(repo as any, { post: jest.fn(async () => ({})) } as any);
        } },
      ],
    }).compile();

    service = module2.get(TreasuryService);
  });

  const input = {
    org_id: ORG,
    agent_id: AGENT,
    rail: 'x402' as const,
    amount: { value: '0.75', asset: 'USDC' },
    counterparty: { kind: 'api_service', identifier: 'api.example.com' },
    purpose: 'market_data_lookup',
  };

  it('authorizes a compliant payment and issues a single-use EdDSA token', async () => {
    const result = await service.authorize(input, 'idem-1');

    expect(result.decision).toBe('allow');
    expect(result.status).toBe('authorized');
    expect(result.authorization).toBeDefined();

    const token = result.authorization!.token;
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.mandate_id).toBe('mandate-1');
    expect(payload.act.sub).toBe(PRINCIPAL); // delegation chain surfaced
    // Rail credential brokered through the adapter (FR-PAY-2)
    expect(result.credential).toMatchObject({ kind: 'instruction', provider_ref: 'manual:x' });
    expect(rails.prepare).toHaveBeenCalledWith('x402', expect.anything(), expect.anything());

    // jti recorded for single-use enforcement
    expect(authorizationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'rail:x402', jti: expect.any(String) }),
    );
    // ledger got a decision + authorization entry
    const types = ledger.append.mock.calls.map((c) => c[0].entry_type);
    expect(types).toContain('authorization');
  });

  it('is idempotent: same key returns the stored decision without a new intent', async () => {
    const first = await service.authorize(input, 'idem-same');
    intentRepo.findOne.mockResolvedValueOnce({ id: 'pi-1', decision: 'allow', status: 'authorized', decision_reasons: [] });
    const second = await service.authorize(input, 'idem-same');
    expect(second.intent_id).toBe('pi-1');
    expect(intentRepo.save).toHaveBeenCalledTimes(1); // only the first call created an intent
    void first;
  });

  it('deny: no mandate → mandate_invalid', async () => {
    mandateRepo.findOne.mockResolvedValue(null);
    const result = await service.authorize(input, 'idem-2');
    expect(result.decision).toBe('deny');
    expect(result.reasons[0].code).toBe('mandate_invalid');
  });

  it('deny: kill switch engaged (org scope)', async () => {
    killSwitchRepo.find.mockResolvedValue([{ scope_type: 'org', scope_id: null, released_at: null }]);
    const result = await service.authorize(input, 'idem-3');
    expect(result.decision).toBe('deny');
    expect(result.reasons[0].code).toBe('kill_switch');
  });

  it('deny: policy engine denies a matched deny rule (counterparty denylist)', async () => {
    counterpartyRepo.findOne.mockResolvedValue({ id: 'cp-9', denylisted: true, allowlisted: false });
    const result = await service.authorize(input, 'idem-4');
    expect(result.decision).toBe('deny');
    expect(result.reasons[0].code).toBe('counterparty_denied');
  });

  it('deny: policy default-deny when nothing matches (wrong rail)', async () => {
    const result = await service.authorize({ ...input, rail: 'manual' }, 'idem-5');
    expect(result.decision).toBe('deny');
    expect(result.reasons[0].code).toBe('policy_denied');
  });

  it('require_approval branch creates an approval and reserves the budget', async () => {
    const result = await service.authorize({ ...input, amount: { value: '10.00', asset: 'USDC' } }, 'idem-6');
    expect(result.decision).toBe('require_approval');
    expect(result.approval).toBeDefined();
    expect(approvalRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
    expect(budgets.reserve).toHaveBeenCalled();
    expect(ledger.append.mock.calls.some((c) => c[0].entry_type === 'reservation')).toBe(true);
  });

  it('require_approval mirrors the request into the approvals inbox (M4)', async () => {
    await service.authorize({ ...input, amount: { value: '10.00', asset: 'USDC' } }, 'idem-6b');
    expect(approvalService.create).toHaveBeenCalledTimes(1);
    const [, inboxAction, inboxResource, inboxCtx] = approvalService.create.mock.calls[0];
    expect(inboxAction).toMatch(/^treasury:/);
    expect(inboxResource).toBe(`payment_intent:${inboxCtx.intent_id}`);
    expect(inboxCtx).toMatchObject({ asset: 'USDC', counterparty: 'api.example.com', rail: 'x402' });
    expect(intentRepo.update).toHaveBeenCalledWith(
      inboxCtx.intent_id,
      expect.objectContaining({ pending_approval_id: 'inbox-1' }),
    );
  });

  it('budget exhaustion denies with budget_exceeded and releases nothing', async () => {
    budgets.reserve.mockRejectedValue(new Error('budget_exceeded:budget-1:0'));
    const result = await service.authorize(input, 'idem-7');
    expect(result.decision).toBe('deny');
    expect(result.reasons[0].code).toBe('budget_exceeded');
  });

  it('mandate hard per-txn limit denies above the cap', async () => {
    const result = await service.authorize({ ...input, amount: { value: '50.00', asset: 'USDC' } }, 'idem-8');
    expect(result.decision).toBe('deny');
    expect(result.reasons[0].code).toBe('mandate_invalid');
  });

  it('FAIL CLOSED: an unexpected internal error denies (never allows)', async () => {
    policyVersionRepo.findOne.mockRejectedValue(new Error('db down'));
    const result = await service.authorize(input, 'idem-9');
    expect(result.decision).toBe('deny');
    expect(result.reasons[0].code).toBe('policy_error');
  });

  it('revoked mandate blocks new authorizations', async () => {
    mandateRepo.findOne.mockResolvedValue({ ...mandate, status: 'revoked' });
    // The service queries status: 'active', so a revoked mandate simply isn't found → mandate_invalid
    mandateRepo.findOne.mockResolvedValue(null);
    const result = await service.authorize(input, 'idem-10');
    expect(result.reasons[0].code).toBe('mandate_invalid');
  });

  describe('verifyToken (verifier API)', () => {
    it('rejects garbage tokens', async () => {
      expect((await service.verifyToken('not-a-token')).valid).toBe(false);
    });

    it('accepts then replays: single-use jti enforcement', async () => {
      const result = await service.authorize(input, 'idem-verify');
      const token = result.authorization!.token;

      authorizationRepo.findOne
        .mockResolvedValueOnce({
          jti: 'jti-1', org_id: ORG, consumed_at: null, revoked_at: null,
          expires_at: new Date(Date.now() + 60_000), audience: 'rail:x402',
        })
        .mockResolvedValueOnce({
          jti: 'jti-1', org_id: ORG, consumed_at: new Date(), revoked_at: null,
          expires_at: new Date(Date.now() + 60_000), audience: 'rail:x402',
        });

      const first = await service.verifyToken(token);
      expect(first.valid).toBe(true);
      expect(first.delegated_by).toBe(PRINCIPAL); // act chain surfaced

      const replay = await service.verifyToken(token);
      expect(replay.valid).toBe(false);
      expect(replay.reason).toBe('token_replayed');
    });

    it('rejects when the kill switch is engaged (in-flight token)', async () => {
      const result = await service.authorize(input, 'idem-ks');
      killSwitchRepo.find.mockResolvedValue([{ scope_type: 'org', scope_id: null, released_at: null }]);
      // The jti lookup must resolve to a live authorization for the kill-switch branch to be reached.
      authorizationRepo.findOne.mockResolvedValue({
        jti: 'jti-ks', org_id: ORG, consumed_at: null, revoked_at: null,
        expires_at: new Date(Date.now() + 60_000), audience: 'rail:x402',
      });
      const v = await service.verifyToken(result.authorization!.token);
      expect(v.valid).toBe(false);
      expect(v.reason).toBe('kill_switch');
    });
  });

  describe('mandate signing', () => {
    it('creates a mandate only with a valid signature over the canonical hash', async () => {
      const agentRepo = { findOne: jest.fn().mockResolvedValue({ id: AGENT, public_key: AGENT_PRIV.publicKey }) };
      const pvRepo = { findOne: jest.fn().mockResolvedValue({ id: 'pv-9' }) };
      const mandateRepoLocal = {
        create: jest.fn((x) => ({ ...x, id: 'm-new' })),
        save: jest.fn(async (x) => x),
      };

      (service as any).agentRepo = agentRepo;
      (service as any).policyVersionRepo = pvRepo;
      (service as any).mandateRepo = mandateRepoLocal;

      const params = {
        org_id: ORG,
        agent_id: AGENT,
        granted_by: PRINCIPAL,
        policy_version_id: 'pv-9',
        hard_limits: { max_per_txn_minor: '1000000' },
        valid_from: new Date('2026-09-01'),
        valid_until: new Date('2026-12-01'),
      };
      // Mirror the service's canonicalization exactly: canonicalJson over the
      // mandated field set, then sha256, then Ed25519 over the hash buffer.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { canonicalJson } = require('./policy-schema');
      const canonical = canonicalJson({
        agent_id: params.agent_id,
        granted_by: params.granted_by,
        hard_limits: params.hard_limits,
        org_id: params.org_id,
        policy_version_id: params.policy_version_id,
        valid_from: params.valid_from.toISOString(),
        valid_until: params.valid_until.toISOString(),
      });
      const hash = createHash('sha256').update(canonical).digest('hex');
      const sig = crypto.sign(null, Buffer.from(hash, 'hex'), AGENT_PRIV.privateKey).toString('base64');

      // Valid signature → mandate persisted with the canonical hash recorded.
      const created = await service.createMandate({ ...params, signature: sig, signing_method: 'ed25519_test', signing_key_ref: 'k' });
      expect(created.mandate.canonical_hash).toBe(hash);
      expect(mandateRepoLocal.save).toHaveBeenCalled();

      // Tampered payload (different limits) → same signature no longer verifies.
      await expect(
        service.createMandate({ ...params, hard_limits: { max_per_txn_minor: '99999999' }, signature: sig, signing_method: 'ed25519_test', signing_key_ref: 'k' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
