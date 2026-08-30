import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentKey, Agent } from '../../database/entities';
import { KeyRotationService } from './key-rotation.service';
import { KeyRotationController } from './key-rotation.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([AgentKey, Agent]), AuditModule],
  controllers: [KeyRotationController],
  providers: [KeyRotationService],
  exports: [KeyRotationService],
})
export class KeyRotationModule {}
