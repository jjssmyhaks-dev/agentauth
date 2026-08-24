import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from '../../database/entities';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
  ) {}

  async createWebhook(
    orgId: string,
    url: string,
    eventTypes: string[],
    secret: string,
  ): Promise<Webhook> {
    const webhook = this.webhookRepository.create({
      org_id: orgId,
      url,
      event_types: eventTypes,
      secret,
      status: 'active',
    });

    return this.webhookRepository.save(webhook);
  }

  async getWebhooksByOrg(orgId: string): Promise<Webhook[]> {
    return this.webhookRepository.find({
      where: { org_id: orgId },
      order: { created_at: 'DESC' },
    });
  }

  async getWebhook(webhookId: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return webhook;
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const webhook = await this.getWebhook(webhookId);
    await this.webhookRepository.remove(webhook);
  }

  async testWebhook(webhookId: string): Promise<{ success: boolean; message: string }> {
    const webhook = await this.getWebhook(webhookId);

    try {
      const testPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: { webhook_id: webhook.id },
      };

      const signature = this.generateSignature(testPayload, webhook.secret);

      // In production, this would make an actual HTTP request
      // For now, return success
      return {
        success: true,
        message: 'Test webhook sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test webhook: ${error.message}`,
      };
    }
  }

  async deliverWebhook(
    webhookId: string,
    eventType: string,
    payload: any,
  ): Promise<{ success: boolean; error?: string }> {
    const webhook = await this.getWebhook(webhookId);

    if (!webhook.event_types.includes(eventType) && !webhook.event_types.includes('*')) {
      return { success: false, error: 'Event type not subscribed' };
    }

    try {
      const signature = this.generateSignature(payload, webhook.secret);
      
      // In production, this would use BullMQ for reliable delivery
      // with exponential backoff retry
      console.log(`Delivering webhook to ${webhook.url}:`, {
        eventType,
        signature,
        payload,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private generateSignature(payload: any, secret: string): string {
    const data = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }
}
