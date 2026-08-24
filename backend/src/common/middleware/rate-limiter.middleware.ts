import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private redis: Redis;
  private windowMs = 60000; // 1 minute
  private maxRequests = 100; // per window

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const orgId = req.body?.org_id || req.query?.org_id || req.headers['x-org-id'];
    
    if (!orgId) {
      return next();
    }

    const key = `rate_limit:${orgId}:${req.path}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    try {
      // Remove old entries
      await this.redis.zremrangebyscore(key, 0, windowStart);

      // Count current requests
      const count = await this.redis.zcard(key);

      if (count >= this.maxRequests) {
        throw new HttpException(
          'Rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Add current request
      await this.redis.zadd(key, now.toString(), `${now}`);
      await this.redis.expire(key, Math.ceil(this.windowMs / 1000));

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (this.maxRequests - count - 1).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil((windowStart + this.windowMs) / 1000).toString());

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If Redis is unavailable, allow the request
      next();
    }
  }
}
