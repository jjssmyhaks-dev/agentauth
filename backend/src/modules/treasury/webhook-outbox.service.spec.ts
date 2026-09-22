import { createHmac } from 'crypto';
import { Repository, In } from 'typeorm';
import {
  TreasuryWebhookOutboxService,
  TREASURY_WEBHOOK_EVENTS,
} from './webhook-outbox.service';
import { TreasuryWebhookOutbox, Webhook } from '../../database/entities';

/**
 * Unit tests for the transactional outbox (NFR-6). The outbox must never
 * break the payment decision path, deliver at-least-once with HMAC-signed
 * payloads, back off exponentially, and dead-letter after MAX_ATTEMPTS.
 */
describe('TreasuryWebhookOutboxService', () => {
  let service: TreasuryWebhookOutboxService;
  let outboxRepo: { save: jest.Mock; find: jest.Mock; findOne: jest.Mock; update: jest.Mock };
  let webhookRepo: { find: jest.Mock };
  const fetchMock = jest.fn();

  const makeRow = (overrides: Partial<TreasuryWebhookOutbox> = {}): TreasuryWebhookOutbox =>
    ({
      id: 'row-1',
      org_id: 'org-1',
      event_type: 'payment.settled',
      payload: { event_id: 'evt-1', intent_id: 'intent-1' },
      cause_id: null,
      status: 'pending',
      attempts: 0,
      available_at: new Date(0),
      delivered_at: null,
      last_error: null,
      last_http_status: null,
      created_at: new Date(),
      ...overrides,
    }) as unknown as TreasuryWebhookOutbox;

  const makeWebhook = (overrides: Partial<Webhook> = {}): Webhook =>
    ({
      id: 'wh-1',
      org_id: 'org-1',
      url: 'https://hooks.example.test/treasury',
      secret: 'whsec_test_123',
      status: 'active',
      event_types: ['payment.settled'],
      ...overrides,
    }) as unknown as Webhook;

  beforeAll(() => {
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    outboxRepo = { save: jest.fn().mockResolvedValue(undefined), find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue(undefined) };
    webhookRepo = { find: jest.fn().mockResolvedValue([]) };
    fetchMock.mockResolvedValue({ ok: true });
    service = new TreasuryWebhookOutboxService(
      outboxRepo as unknown as Repository<TreasuryWebhookOutbox>,
      webhookRepo as unknown as Repository<Webhook>,
    );
  });

  it('enqueues an event with a generated event_id', async () => {
    await service.enqueue({ org_id: 'org-1', event_type: 'payment.settled', payload: { intent_id: 'i-1' } });
    expect(outboxRepo.save).toHaveBeenCalledTimes(1);
    const row = outboxRepo.save.mock.calls[0][0] as TreasuryWebhookOutbox;
    expect(row.org_id).toBe('org-1');
    expect(row.event_type).toBe('payment.settled');
    expect(row.payload.event_id).toEqual(expect.any(String));
  });

  it('never breaks the caller when persistence fails (outbox is best-effort for producers)', async () => {
    outboxRepo.save.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.enqueue({ org_id: 'org-1', event_type: 'payment.settled', payload: {} }),
    ).resolves.toBeUndefined();
  });

  it('enqueueOnce skips a (cause_id, event_type) pair that already fired', async () => {
    outboxRepo.findOne.mockResolvedValueOnce(makeRow({ cause_id: 'budget-1' }));
    const fired = await service.enqueueOnce({
      org_id: 'org-1',
      event_type: 'budget.threshold_reached',
      payload: {},
      cause_id: 'budget-1',
    });
    expect(fired).toBe(false);
    expect(outboxRepo.save).not.toHaveBeenCalled();
  });

  it('enqueueOnce fires once when no prior row exists', async () => {
    const fired = await service.enqueueOnce({
      org_id: 'org-1',
      event_type: 'budget.threshold_reached',
      payload: { threshold: 80 },
      cause_id: 'budget-1',
    });
    expect(fired).toBe(true);
    expect(outboxRepo.save).toHaveBeenCalledTimes(1);
  });

  it('delivers due rows to subscribed webhooks with a valid HMAC signature', async () => {
    const row = makeRow();
    outboxRepo.find.mockResolvedValue([row]);
    webhookRepo.find.mockResolvedValue([makeWebhook()]);

    const { delivered } = await service.drain(new Date('2026-09-22T12:00:00Z'));
    expect(delivered).toBe(1);
    expect(row.status).toBe('delivered');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-AgentAuth-Event']).toBe('payment.settled');
    const expectedSig = createHmac('sha256', 'whsec_test_123').update(init.body as string).digest('hex');
    expect((init.headers as Record<string, string>)['X-AgentAuth-Signature']).toBe(expectedSig);
  });

  it('marks rows with no subscriber as delivered (no infinite retry)', async () => {
    const row = makeRow();
    outboxRepo.find.mockResolvedValue([row]);
    webhookRepo.find.mockResolvedValue([]);

    await service.drain();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(row.status).toBe('delivered');
    expect(row.last_error).toBe('no_subscriber');
  });

  it('backs off exponentially after a failed delivery', async () => {
    const row = makeRow();
    outboxRepo.find.mockResolvedValue([row]);
    webhookRepo.find.mockResolvedValue([makeWebhook()]);
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await service.drain();
    expect(row.status).toBe('pending');
    expect(row.attempts).toBe(1);
    expect(row.available_at!.getTime()).toBeGreaterThan(Date.now());
  });

  it('dead-letters after MAX_ATTEMPTS failed deliveries', async () => {
    const row = makeRow({ attempts: 11 }); // one more failure reaches the max
    outboxRepo.find.mockResolvedValue([row]);
    webhookRepo.find.mockResolvedValue([makeWebhook()]);
    fetchMock.mockRejectedValueOnce(new Error('still down'));

    await service.drain();
    expect(row.status).toBe('failed');
    expect(row.attempts).toBe(12);
  });

  it('respects event_types subscriptions ("*" wildcard included)', async () => {
    const row = makeRow({ event_type: 'killswitch.engaged' });
    outboxRepo.find.mockResolvedValue([row]);
    webhookRepo.find.mockResolvedValue([makeWebhook({ event_types: ['*'] })]);

    const { delivered } = await service.drain();
    expect(delivered).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('requeueFailed resets dead-lettered rows for the org', async () => {
    outboxRepo.find.mockResolvedValue([makeRow({ status: 'failed', attempts: 12 }), makeRow({ id: 'row-2', status: 'failed', attempts: 12 })]);
    const n = await service.requeueFailed('org-1');
    expect(n).toBe(2);
    expect(outboxRepo.update).toHaveBeenCalledWith(
      { id: In(['row-1', 'row-2']) },
      expect.objectContaining({ status: 'pending', attempts: 0 }),
    );
  });

  it('defines the full lifecycle event vocabulary', () => {
    expect(TREASURY_WEBHOOK_EVENTS).toEqual(
      expect.arrayContaining([
        'payment.decided',
        'payment.settled',
        'payment.cancelled',
        'approval.required',
        'killswitch.engaged',
        'budget.threshold_reached',
      ]),
    );
  });
});
