import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load env from project root .env.local
config({ path: join(__dirname, '../../.env.local') });
config({ path: join(__dirname, '../../.env') });

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

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Organization, User, Agent, Grant, TokenIssued, PendingApproval, AuditLog, Webhook],
  migrations: [join(__dirname, 'database/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: true,
});
