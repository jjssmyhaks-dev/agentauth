import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
  TreasuryRailConnection,
  TreasuryPaymentAccount,
  Agent,
} from '../../database/entities';
import { TreasuryService } from './treasury.service';
import { TreasuryBudgetsService } from './budgets.service';
import { TreasuryLedgerService } from './ledger.service';
import { TreasuryController, TreasuryPublicController } from './treasury.controller';
import { RailsService } from './rails/rails.service';
import { ManualRailAdapter } from './rails/manual.adapter';
import { X402RailAdapter } from './rails/x402.adapter';
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
      TreasuryRailConnection,
      TreasuryPaymentAccount,
      Agent,
    ]),
  ],
  controllers: [TreasuryController, TreasuryPublicController],
  providers: [TreasuryService, TreasuryBudgetsService, TreasuryLedgerService, RailsService, ManualRailAdapter, X402RailAdapter],
  exports: [TreasuryService, TreasuryBudgetsService, TreasuryLedgerService, RailsService],
})
export class TreasuryModule {}
