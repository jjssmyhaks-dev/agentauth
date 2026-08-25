import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Webhook } from '../../database/entities';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhookRepo: Repository<Webhook>,
  ) {}

  async create(orgId: string, url: string, eventTypes: string[], secret: string): Promise<Webhook> {
    const webhook = this.webhookRepo.create({
      org_id: orgId,
      url,
      event_types: eventTypes,
      secret,
      status: 'active',
    });
    this.logger.log(`Webhook created for org ${orgId}: ${url}`);
    return this.webhookRepo.save(webhook);
  }

  async findByOrg(orgId: string): Promise<Webhook[]> {
    return this.webhookRepo.find({ where: { org_id: orgId }, order: { created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<Webhook> {
    const webhook = await this.webhookRepo.findOne({ where: { id } });
    if (!webhook) throw new NotFoundException(`Webhook ${id} not found`);
    return webhook;
  }

  async remove(id: string): Promise<void> {
    const webhook = await this.findOne(id);
    await this.webhookRepo.remove(webhook);
    this.logger.log(`Webhook deleted: ${id}`);
  }

  async test(id: string): Promise<{ success: boolean; message: string }> {
    const webhook = await this.findOne(id);
    const payload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { webhook_id: webhook.id },
    };
    return this.deliverWithRetry(webhook, payload);
  }

  async deliver(webhookId: string, eventType: string, payload: any): Promise<void> {
    const webhook = await this.findOne(webhookId);
    if (!webhook.event_types.includes(eventType) && !webhook.event_types.includes('*')) return;

    const result = await this.deliverWithRetry(webhook, { event: eventType, data: payload, timestamp: new Date().toISOString() });
    if (!result.success) {
      webhook.failure_count++;
      await this.webhookRepo.save(webhook);
    }
  }

  private async deliverWithRetry(
    webhook: Webhook,
    payload: any,
    maxRetries = 5,
  ): Promise<{ success: boolean; message: string }> {
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-AgentAuth-Signature': signature,
            'X-AgentAuth-Event': payload.event,
            'User-Agent': 'AgentAuth-Webhook/1.0',
          },
          body,
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          this.logger.log(`Webhook delivered: ${webhook.url} (attempt ${attempt + 1})`);
          return { success: true, message: 'Delivered' };
        }

        this.logger.warn(`Webhook ${webhook.url} returned ${response.status} (attempt ${attempt + 1})`);
      } catch (err) {
        this.logger.warn(`Webhook ${webhook.url} failed attempt ${attempt + 1}: ${err.message}`);
      }

      // Exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    this.logger.error(`Webhook delivery failed after ${maxRetries} attempts: ${webhook.url}`);
    return { success: false, message: `Failed after ${maxRetries} attempts` };
  }
}
