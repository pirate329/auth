import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisPort = parseInt(
      this.configService.get<string>('REDIS_PORT', '6379'),
      10,
    );
    const redisPass = this.configService.get<string>('REDIS_PASSWORD');
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    this.client = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPass,
      db: 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => console.log('Redis connected'));
    this.client.on('error', (err) => console.error('Redis error:', err));
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
