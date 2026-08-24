import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  async createWebhook(
    @Body() body: {
      org_id: string;
      url: string;
      event_types: string[];
      secret: string;
    },
  ) {
    const webhook = await this.webhooksService.createWebhook(
      body.org_id,
      body.url,
      body.event_types,
      body.secret,
    );

    return {
      webhook_id: webhook.id,
      url: webhook.url,
      event_types: webhook.event_types,
      created_at: webhook.created_at,
    };
  }

  @Get()
  async listWebhooks(@Query('org_id') orgId: string) {
    return this.webhooksService.getWebhooksByOrg(orgId);
  }

  @Delete(':webhook_id')
  async deleteWebhook(@Param('webhook_id') webhookId: string) {
    await this.webhooksService.deleteWebhook(webhookId);
    return { success: true };
  }

  @Post(':webhook_id/test')
  async testWebhook(@Param('webhook_id') webhookId: string) {
    return this.webhooksService.testWebhook(webhookId);
  }
}
