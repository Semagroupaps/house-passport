import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Stiller en delt Redis-forbindelse til rådighed (cache, rate limiting, kø).
 * Returnerer null når REDIS_URL ikke er sat, så lokal udvikling kan køre uden Redis.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis | null =>
        process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null }) : null,
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
