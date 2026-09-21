import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from '../../database/entities';
import { WebhooksService } from './webhooks.service';

/**
 * Fan-out of org events to every subscribed webhook. Fire-and-forget by
 * design: a slow or dead consumer must never delay an authorization
 * decision. Delivery failures are logged (and counted on the webhook row)
 * by WebhooksService's retry loop.
 */
@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhookRepo: Repository<Webhook>,
    private webhooksService: WebhooksService,
  ) {}

  /** Deliver `eventType` to every active webhook of the org subscribed to it. */
  async emit(orgId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const webhooks = await this.webhookRepo.find({
        where: { org_id: orgId, status: 'active' },
      });
      const subscribed = webhooks.filter(
        (w) => w.event_types.includes(eventType) || w.event_types.includes('*'),
      );
      if (subscribed.length === 0) return;

      this.logger.log(`Emitting ${eventType} to ${subscribed.length} webhook(s) for org ${orgId}`);
      // Await the first attempt of each delivery so tests observe them, but
      // failures are absorbed — emit() itself never throws to its callers.
      await Promise.allSettled(
        subscribed.map((w) => this.webhooksService.deliver(w.id, eventType, payload)),
      );
    } catch (err) {
      this.logger.warn(`Failed to emit ${eventType} for org ${orgId}: ${err}`);
    }
  }
}
