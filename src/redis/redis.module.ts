import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global() // Makes it available everywhere without importing
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
