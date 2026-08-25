import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      try {
        // REDIS_URL may be "redis-cli -u redis://..." format, extract just the URL
        const cleanUrl = url.includes('redis-cli')
          ? url.replace(/.*?(redis:\/\/.*)/, '$1')
          : url;
        this.client = new Redis(cleanUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 200, 5000),
          connectTimeout: 5000,
          lazyConnect: true,
        });
        this.client.connect().catch(() => {
          this.logger.warn('Redis connection failed — falling back to in-memory');
          this.client = null;
        });
      } catch {
        this.logger.warn('Redis URL invalid — falling back to in-memory');
      }
    }
    if (!this.client) {
      this.logger.warn('No REDIS_URL — using in-memory store (dev only)');
    }
  }

  get isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  // ── Nonce store (replaces in-memory Map) ──
  async setNonce(nonce: string, agentId: string, ttlSeconds = 60): Promise<void> {
    const key = `nonce:${nonce}`;
    if (this.client) {
      await this.client.setex(key, ttlSeconds, agentId);
    } else {
      this.inMemoryNonceStore.set(key, { agentId, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
  }

  async getNonce(nonce: string): Promise<string | null> {
    const key = `nonce:${nonce}`;
    if (this.client) {
      return this.client.get(key);
    }
    const entry = this.inMemoryNonceStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.inMemoryNonceStore.delete(key);
      return null;
    }
    return entry.agentId;
  }

  async deleteNonce(nonce: string): Promise<void> {
    const key = `nonce:${nonce}`;
    if (this.client) {
      await this.client.del(key);
    } else {
      this.inMemoryNonceStore.delete(key);
    }
  }

  // ── Rate limiting ──
  async checkRateLimit(key: string, windowMs: number, maxRequests: number): Promise<{ allowed: boolean; remaining: number }> {
    if (!this.client) return { allowed: true, remaining: maxRequests };

    const now = Date.now();
    const windowStart = now - windowMs;
    const rateKey = `ratelimit:${key}`;

    const pipeline = this.client.pipeline();
    pipeline.zremrangebyscore(rateKey, 0, windowStart);
    pipeline.zadd(rateKey, now.toString(), `${now}-${Math.random()}`);
    pipeline.zcard(rateKey);
    pipeline.pexpire(rateKey, windowMs);

    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) || 0;

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
    };
  }

  // ── Generic key-value ──
  async get(key: string): Promise<string | null> {
    return this.client?.get(key) ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.client) {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    }
  }

  async del(key: string): Promise<void> {
    await this.client?.del(key);
  }

  // In-memory fallback
  private inMemoryNonceStore = new Map<string, { agentId: string; expiresAt: number }>();

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
