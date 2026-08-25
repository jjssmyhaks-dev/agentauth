import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingApproval, Organization } from '../../database/entities';
import { ApprovalService } from './approval.service';
import { ApprovalController } from './approval.controller';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PendingApproval, Organization]),
    AuditModule,
    IdentityModule,
  ],
  controllers: [ApprovalController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}
