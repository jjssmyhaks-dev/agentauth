import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, LessThanOrEqual } from 'typeorm';
import * as crypto from 'crypto';
import { TreasuryWebhookOutbox, Webhook } from '../../database/entities';

/**
 * Transactional outbox for treasury lifecycle events (NFR-6, §12.3).
 *
 * Producers call `enqueue()` INSIDE the same transaction as the state change
 * (or on its success path); the poller delivers later, so a webhook outage
 * can never affect a decision. Delivery is at-least-once with exponential
 * backoff; consumers dedupe on `event_id`.
 *
 * Event vocabulary (treasury.* namespace, distinct from the platform's
 * `policy.denied` / `approval.*` events in WebhookEventsService):
 *   payment.decided | payment.settled | payment.cancelled | payment.failed
 *   approval.required | killswitch.engaged | killswitch.released
 *   budget.threshold_reached
 */
export const TREASURY_WEBHOOK_EVENTS = [
  'payment.decided',
  'payment.settled',
  'payment.cancelled',
  'payment.failed',
  'approval.required',
  'killswitch.engaged',
  'killswitch.released',
  'budget.threshold_reached',
] as const;

const BATCH_SIZE = 25;
const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 12;

@Injectable()
export class TreasuryWebhookOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TreasuryWebhookOutboxService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @InjectRepository(TreasuryWebhookOutbox)
    private readonly outboxRepo: Repository<TreasuryWebhookOutbox>,
    @InjectRepository(Webhook)
    private readonly webhookRepo: Repository<Webhook>,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.drain(), POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Enqueue an event. When called with an EntityManager this lands in the
   * caller's transaction (true outbox); without one it commits immediately,
   * which is still safe because every treasury state change is durable
   * before the event is produced.
   */
  async enqueue(
    event: {
      org_id: string;
      event_type: (typeof TREASURY_WEBHOOK_EVENTS)[number];
      payload: Record<string, any>;
      cause_id?: string | null;
    },
    em?: { getRepository: (e: any) => Repository<TreasuryWebhookOutbox> },
  ): Promise<void> {
    const row = {
      org_id: event.org_id,
      event_type: event.event_type,
      payload: {
        event_id: crypto.randomUUID(),
        ...event.payload,
      },
      cause_id: event.cause_id ?? null,
    } as unknown as TreasuryWebhookOutbox;
    try {
      if (em) {
        await em.getRepository(TreasuryWebhookOutbox).save(row);
      } else {
        await this.outboxRepo.save(row);
      }
    } catch (err: any) {
      // The outbox must never break the decision path — log and continue.
      this.logger.error(`outbox enqueue failed for ${event.event_type}: ${err?.message ?? err}`);
    }
  }

  /**
   * Enqueue only if no row with this (cause_id, event_type) exists yet — the
   * "fire once per period" semantic for budget thresholds, using the outbox
   * itself as the record of what has fired.
   */
  async enqueueOnce(event: {
    org_id: string;
    event_type: (typeof TREASURY_WEBHOOK_EVENTS)[number];
    payload: Record<string, any>;
    cause_id?: string | null;
  }): Promise<boolean> {
    if (event.cause_id) {
      const existing = await this.outboxRepo.findOne({
        where: { cause_id: event.cause_id, event_type: event.event_type },
      });
      if (existing) return false;
    }
    await this.enqueue(event);
    return true;
  }

  /**
   * Deliver every due pending row. Exported for tests and manual triggers;
   * the interval calls this too.
   */
  async drain(now = new Date()): Promise<{ processed: number; delivered: number; failed: number }> {
    if (this.running) return { processed: 0, delivered: 0, failed: 0 };
    this.running = true;
    let processed = 0;
    let delivered = 0;
    let failed = 0;
    let batch: TreasuryWebhookOutbox[] = [];
    try {
      batch = await this.outboxRepo.find({
        where: { status: 'pending', available_at: LessThanOrEqual(now) },
        order: { created_at: 'ASC' },
        take: BATCH_SIZE,
      });
      for (const row of batch) {
        processed++;
        try {
          const ok = await this.deliverRow(row);
          if (ok) delivered++;
          else failed++;
        } catch (err: any) {
          this.logger.warn(`outbox row ${row.id} delivery error: ${err?.message ?? err}`);
          failed++;
          await this.markFailure(row, 0, String(err?.message ?? err));
        }
      }
    } finally {
      this.running = false;
    }
    if (delivered + failed > 0) {
      this.logger.log(`outbox drain: ${delivered} delivered, ${failed} pending/failed`);
    }
    return { processed, delivered, failed };
  }

  /** Deliver one row to all subscribed webhooks. True if fully delivered. */
  private async deliverRow(row: TreasuryWebhookOutbox): Promise<boolean> {
    const webhooks = await this.webhookRepo.find({
      where: { org_id: row.org_id, status: 'active' },
    });
    const subscribed = webhooks.filter(
      (w) => w.event_types.includes(row.event_type) || w.event_types.includes('*'),
    );

    if (subscribed.length === 0) {
      // No subscriber: mark delivered so the row doesn't retry forever.
      row.status = 'delivered';
      row.delivered_at = new Date();
      row.last_error = 'no_subscriber';
      await this.outboxRepo.save(row);
      return true;
    }

    const body = JSON.stringify({
      event: row.event_type,
      event_id: row.payload.event_id,
      data: { ...row.payload, event_id: undefined },
      timestamp: new Date().toISOString(),
    });

    const results = await Promise.all(
      subscribed.map(async (w) => {
        const signature = crypto.createHmac('sha256', w.secret).update(body).digest('hex');
        try {
          const res = await fetch(w.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-AgentAuth-Signature': signature,
              'X-AgentAuth-Event': row.event_type,
              'X-AgentAuth-Delivery': String(row.payload.event_id),
              'User-Agent': 'AgentAuth-Treasury-Webhook/1.0',
            },
            body,
            signal: AbortSignal.timeout(10000),
          });
          return res.ok;
        } catch {
          return false;
        }
      }),
    );

    if (results.every(Boolean)) {
      row.status = 'delivered';
      row.delivered_at = new Date();
      row.attempts += 1;
      row.last_http_status = 200;
      row.last_error = null;
      await this.outboxRepo.save(row);
      return true;
    }
    await this.markFailure(row, results.filter(Boolean).length, `${results.filter((r) => !r).length}/${results.length} endpoints failed`);
    return false;
  }

  private async markFailure(row: TreasuryWebhookOutbox, httpStatus: number, error: string): Promise<void> {
    row.attempts += 1;
    row.last_error = error.slice(0, 500);
    if (httpStatus > 0) row.last_http_status = httpStatus;
    if (row.attempts >= MAX_ATTEMPTS) {
      row.status = 'failed';
      this.logger.error(`outbox row ${row.id} (${row.event_type}) permanently failed after ${row.attempts} attempts`);
    } else {
      // Exponential backoff: 2^n seconds, capped at 10 minutes.
      const delaySec = Math.min(Math.pow(2, row.attempts), 600);
      row.available_at = new Date(Date.now() + delaySec * 1000);
    }
    await this.outboxRepo.save(row);
  }

  /** Ops handle: retry rows that hit MAX_ATTEMPTS (transient outage recovery). */
  async requeueFailed(orgId: string): Promise<number> {
    const rows = await this.outboxRepo.find({ where: { org_id: orgId, status: 'failed' } });
    if (rows.length === 0) return 0;
    await this.outboxRepo.update(
      { id: In(rows.map((r) => r.id)) },
      { status: 'pending', attempts: 0, available_at: new Date(), last_error: null },
    );
    return rows.length;
  }
}
