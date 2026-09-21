import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from '../../common/dto';
import { orgFrom } from '../policies/policies-org.helper';

@ApiTags('Webhooks')
@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a webhook (org from the bearer key when present)' })
  async create(@Req() request: any, @Body() dto: CreateWebhookDto) {
    const webhook = await this.webhooksService.create(orgFrom(request, dto.org_id), dto.url, dto.event_types, dto.secret);
    return { webhook_id: webhook.id, url: webhook.url, event_types: webhook.event_types, created_at: webhook.created_at };
  }

  @Get()
  @ApiOperation({ summary: 'List webhooks for the resolved org' })
  async findAll(@Req() request: any, @Query('org_id') orgId: string) {
    return this.webhooksService.findByOrg(orgFrom(request, orgId));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook' })
  async remove(@Param('id') id: string) {
    await this.webhooksService.remove(id);
    return { success: true };
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send test webhook delivery' })
  async test(@Param('id') id: string) {
    return this.webhooksService.test(id);
  }
}
