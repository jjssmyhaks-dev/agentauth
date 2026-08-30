import * as path from 'path';
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from './common/redis/redis.module';
import { IdentityModule } from './modules/identity/identity.module';
import { TokenModule } from './modules/token/token.module';
import { GrantsModule } from './modules/grants/grants.module';
import { AuditModule } from './modules/audit/audit.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { RateLimiterMiddleware } from './common/middleware/rate-limiter.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  Organization, User, Agent, Grant, TokenIssued,
  PendingApproval, AuditLog, Webhook,
  Policy, TrustScore, TrustEvent, Session,
  EnvironmentFingerprint, AgentKey, AgentAttribute,
  AgentGroup, SyncSource, SyncJob, DocEmbedding,
  AgentUsage,
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
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
        Organization, User, Agent, Grant, TokenIssued,
        PendingApproval, AuditLog, Webhook,
        Policy, TrustScore, TrustEvent, Session,
        EnvironmentFingerprint, AgentKey, AgentAttribute,
        AgentGroup, SyncSource, SyncJob, DocEmbedding,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimiterMiddleware)
      .forRoutes('v1/tokens', 'v1/permissions', 'v1/analytics');
  }
}
