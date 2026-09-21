import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private windowMs = 60000; // 1 minute
  private maxRequests = 100; // per window per org

  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Prefer org identity, fall back to client IP so unauthenticated callers
    // (challenge fetches, unauthenticated probes) are throttled too.
    const orgId =
      req.body?.org_id ||
      req.query?.org_id ||
      (req.headers['x-org-id'] as string | undefined);
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const bucketKey = orgId || ip;

    try {
      const { allowed, remaining } = await this.redis.checkRateLimit(
        `${bucketKey}:${req.method}:${req.path}`,
        this.windowMs,
        this.maxRequests,
      );

      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + this.windowMs) / 1000).toString());

      if (!allowed) {
        res.setHeader('Retry-After', Math.ceil(this.windowMs / 1000).toString());
        throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      next(); // Redis unavailable — allow request (fail-open)
    }
  }
}
