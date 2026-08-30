import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  Organization,
  User,
  Agent,
  Grant,
  TokenIssued,
  PendingApproval,
  AuditLog,
  Webhook,
  Policy,
  TrustScore,
  TrustEvent,
  Session,
  EnvironmentFingerprint,
  AgentKey,
  AgentAttribute,
  AgentGroup,
  SyncSource,
  SyncJob,
  DocEmbedding,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          Organization, User, Agent, Grant, TokenIssued,
          PendingApproval, AuditLog, Webhook,
          Policy, TrustScore, TrustEvent, Session,
          EnvironmentFingerprint, AgentKey, AgentAttribute,
          AgentGroup, SyncSource, SyncJob, DocEmbedding,
        ],
synchronize: false,
migrations: [__dirname + '/migrations/*{.ts,.js}'],
migrationsRun: true,
logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
