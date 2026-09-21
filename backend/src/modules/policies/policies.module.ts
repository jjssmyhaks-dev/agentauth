import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Policy, PolicyVersion } from '../../database/entities';
import { PoliciesService } from './policies.service';
import { PoliciesController } from './policies.controller';
import { PolicyEngineService } from './policy-engine.service';
import { PolicyVersionsService } from './policy-versions.service';
import { TriggerEmittersService } from './trigger-emitters.service';
import { GroupsModule } from '../groups/groups.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Policy, PolicyVersion]), GroupsModule, WebhooksModule, AuditModule],
  controllers: [PoliciesController],
  providers: [PoliciesService, PolicyEngineService, PolicyVersionsService, TriggerEmittersService],
  exports: [PoliciesService, PolicyEngineService, PolicyVersionsService, TriggerEmittersService],
})
export class PoliciesModule {}
