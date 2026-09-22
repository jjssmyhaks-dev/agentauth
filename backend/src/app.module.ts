import * as path from 'path';
import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { ApiKeyGuard } from './modules/auth/api-key.guard';
import { IdentityModule } from './modules/identity/identity.module';
import { TokenModule } from './modules/token/token.module';
import { GrantsModule } from './modules/grants/grants.module';
import { AuditModule } from './modules/audit/audit.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { GroupsModule } from './modules/groups/groups.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { RateLimiterMiddleware } from './common/middleware/rate-limiter.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  Organization, User, Agent, Grant, TokenIssued,
  PendingApproval, AuditLog, Webhook,
  Policy, PolicyVersion, TrustScore, TrustEvent, Session, ApiKey,
  EnvironmentFingerprint, AgentKey, AgentAttribute,
  AgentGroup, SyncSource, SyncJob, DocEmbedding, DelegatedToken,
  AgentUsage,
  TreasuryPolicy, TreasuryPolicyVersion, TreasuryMandate, TreasuryCounterparty,
  TreasuryPaymentIntent, TreasuryBudget, TreasuryBudgetPeriod,
  TreasuryBudgetReservation, TreasuryApproval, TreasuryApprovalDecision,
  TreasuryAuthorization, TreasuryKillSwitch, TreasuryLedgerEntry,
  TreasuryRailConnection, TreasuryPaymentAccount,
  TreasuryProofNonce, TreasuryWebhookOutbox,
} from './database/entities';
import { PoliciesModule } from './modules/policies/policies.module';
import { TrustModule } from './modules/trust/trust.module';
import { AttributesModule } from './modules/attributes/attributes.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { FingerprintsModule } from './modules/fingerprints/fingerprints.module';
import { KeyRotationModule } from './modules/key-rotation/key-rotation.module';
import { GraphModule } from './modules/graph/graph.module';
import { SyncModule } from './modules/sync/sync.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { TreasuryModule } from './modules/treasury/treasury.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.join(process.cwd(), '..', '.env.local'),
        path.join(process.cwd(), '.env.local'),
        path.join(process.cwd(), '.env'),
      ],
    }),
    RedisModule,
    AuthModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [  Organization, User, Agent, Grant, TokenIssued,
  PendingApproval, AuditLog, Webhook,
  Policy, PolicyVersion, TrustScore, TrustEvent, Session, ApiKey,
  EnvironmentFingerprint, AgentKey, AgentAttribute,
  AgentGroup, SyncSource, SyncJob, DocEmbedding,
  DelegatedToken,
  TreasuryPolicy, TreasuryPolicyVersion, TreasuryMandate, TreasuryCounterparty,
  TreasuryPaymentIntent, TreasuryBudget, TreasuryBudgetPeriod,
  TreasuryBudgetReservation, TreasuryApproval, TreasuryApprovalDecision,
  TreasuryAuthorization, TreasuryKillSwitch, TreasuryLedgerEntry,
  TreasuryRailConnection, TreasuryPaymentAccount,
  TreasuryProofNonce, TreasuryWebhookOutbox,
    ],
      ssl: process.env.DATABASE_URL?.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : false,
      // synchronize: false in production — use migrations
      // Keep true only for dev when DATABASE_URL points to dev DB
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Organization]),
    IdentityModule,
    TokenModule,
    GrantsModule,
    AuditModule,
    ApprovalModule,
    WebhooksModule,
    GroupsModule,
    OrgsModule,
    PoliciesModule,
    TrustModule,
    AttributesModule,
    SessionsModule,
    FingerprintsModule,
    KeyRotationModule,
    GraphModule,
    SyncModule,
    AssistantModule,
    AnalyticsModule,
    TreasuryModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Rate-limit every API route per org (fallback key when no org context:
    // client IP). Health/docs/JWKS stay open — they must answer for
    // monitoring, humans, and token verification even when throttled.
    consumer
      .apply(RateLimiterMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'docs', method: RequestMethod.GET },
        { path: 'docs/(.*)', method: RequestMethod.GET },
        { path: '.well-known/(.*)', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
