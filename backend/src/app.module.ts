import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from './modules/identity/identity.module';
import { TokenModule } from './modules/token/token.module';
import { GrantsModule } from './modules/grants/grants.module';
import { AuditModule } from './modules/audit/audit.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { OrgsController } from './modules/orgs/orgs.controller';
import { RateLimiterMiddleware } from './common/middleware/rate-limiter.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  Organization,
  User,
  Agent,
  Grant,
  TokenIssued,
  PendingApproval,
  AuditLog,
  Webhook,
} from './database/entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
        Organization,
        User,
        Agent,
        Grant,
        TokenIssued,
        PendingApproval,
        AuditLog,
        Webhook,
      ],
      synchronize: true, // Disable in production
    }),
    TypeOrmModule.forFeature([Organization]),
    IdentityModule,
    TokenModule,
    GrantsModule,
    AuditModule,
    ApprovalModule,
    WebhooksModule,
  ],
  controllers: [AppController, OrgsController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimiterMiddleware)
      .forRoutes('v1/tokens', 'v1/permissions');
  }
}
