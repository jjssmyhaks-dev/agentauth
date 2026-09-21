import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import {
  TreasuryPolicy,
  TreasuryPolicyVersion,
  TreasuryMandate,
  TreasuryCounterparty,
  TreasuryPaymentIntent,
  TreasuryBudget,
  TreasuryBudgetPeriod,
  TreasuryBudgetReservation,
  TreasuryApproval,
  TreasuryApprovalDecision,
  TreasuryAuthorization,
  TreasuryKillSwitch,
  TreasuryLedgerEntry,
  Agent,
} from '../../database/entities';
import { TreasuryService } from './treasury.service';
import { TreasuryBudgetsService } from './budgets.service';
import { TreasuryLedgerService } from './ledger.service';
import { TreasuryController, TreasuryPublicController } from './treasury.controller';
import { ApprovalModule } from '../approval/approval.module';

@Module({
  imports: [
    ApprovalModule,
    TypeOrmModule.forFeature([
      TreasuryPolicy,
      TreasuryPolicyVersion,
      TreasuryMandate,
      TreasuryCounterparty,
      TreasuryPaymentIntent,
      TreasuryBudget,
      TreasuryBudgetPeriod,
      TreasuryBudgetReservation,
      TreasuryApproval,
      TreasuryApprovalDecision,
      TreasuryAuthorization,
      TreasuryKillSwitch,
      TreasuryLedgerEntry,
      Agent,
    ]),
    JwtModule.register({
      signOptions: { algorithm: 'EdDSA' as any },
    }),
  ],
  controllers: [TreasuryController, TreasuryPublicController],
  providers: [TreasuryService, TreasuryBudgetsService, TreasuryLedgerService],
  exports: [TreasuryService, TreasuryBudgetsService, TreasuryLedgerService],
})
export class TreasuryModule {}
