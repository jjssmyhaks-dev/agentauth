import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Organization } from './database/entities';
import { RedisService } from './common/redis/redis.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
    private redis: RedisService,
  ) {}

  async checkDatabase(): Promise<boolean> {
    try {
      await this.orgRepo.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async createApiKey(orgId: string, name: string, scopes: string[]) {
    const apiKey = `ak_${crypto.randomBytes(24).toString('hex')}`;
    const id = uuidv4();
    const keyPrefix = apiKey.substring(0, 12);

    // Store API key metadata in Redis (in production, use a DB table)
    const keyData = JSON.stringify({
      id,
      org_id: orgId,
      name,
      scopes,
      prefix: keyPrefix,
      created_at: new Date().toISOString(),
    });
    await this.redis.set(`apikey:${apiKey}`, keyData, 86400 * 365); // 1 year
    await this.redis.set(`apikey-prefix:${keyPrefix}:${orgId}`, apiKey, 86400 * 365);

    this.logger.log(`API key created: ${name} (org: ${orgId})`);
    return {
      id,
      name,
      key: apiKey,
      prefix: keyPrefix,
      scopes,
      created_at: new Date().toISOString(),
      // Only show full key once
      message: 'Store this key securely — it will not be shown again.',
    };
  }

  async listApiKeys(orgId: string) {
    // In production, query from a DB table
    // For now, return instructions
    return {
      message: 'API keys are stored securely. Use the prefix to identify them.',
      docs: 'POST /api/v1/api-keys to create a new key.',
    };
  }
}
