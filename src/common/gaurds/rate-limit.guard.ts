import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  points: number;  // Number of requests
  duration: number; // Time window in seconds
  keyPrefix?: string;
}

export const RateLimit = (options: RateLimitOptions) => 
  Reflect.metadata(RATE_LIMIT_KEY, options);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!rateLimitOptions) {
      return true; // No rate limit applied
    }

    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    const userId = request.user?.id || ip; // Use userId if authenticated, else IP

    const key = `${rateLimitOptions.keyPrefix || 'rate_limit'}:${userId}`;
    const redis = this.redisService.getClient();

    // Get current count
    const current = await redis.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= rateLimitOptions.points) {
      const ttl = await redis.ttl(key);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests. Try again in ${ttl} seconds.`,
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    const multi = redis.multi();
    multi.incr(key);
    
    if (count === 0) {
      multi.expire(key, rateLimitOptions.duration);
    }
    
    await multi.exec();

    return true;
  }
}