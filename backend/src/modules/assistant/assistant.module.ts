import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, Policy, TrustScore, TrustEvent, Agent } from '../../database/entities';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, Policy, TrustScore, TrustEvent, Agent])],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
