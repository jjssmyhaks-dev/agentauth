import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Grant } from '../../database/entities';
import { GrantsService } from './grants.service';
import { GrantsController } from './grants.controller';
import { TokenModule } from '../token/token.module';
import { IdentityModule } from '../identity/identity.module';
import { PoliciesModule } from '../policies/policies.module';
import { AuditModule } from '../audit/audit.module';
import { ApprovalModule } from '../approval/approval.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Grant]),
    TokenModule,
    IdentityModule,
    PoliciesModule,
    AuditModule,
    ApprovalModule,
  ],
  controllers: [GrantsController],
  providers: [GrantsService],
  exports: [GrantsService],
})
export class GrantsModule {}
