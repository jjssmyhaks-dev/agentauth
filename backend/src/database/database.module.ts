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
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
