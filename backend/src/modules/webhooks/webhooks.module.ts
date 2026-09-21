import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from '../../database/entities';
import { WebhooksService } from './webhooks.service';
import { WebhookEventsService } from './webhook-events.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Webhook])],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookEventsService],
  exports: [WebhooksService, WebhookEventsService],
})
export class WebhooksModule {}
