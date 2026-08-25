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
} from './database/entities';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimiterMiddleware)
      .forRoutes('v1/tokens', 'v1/permissions');
  }
}
