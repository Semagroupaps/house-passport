import { Global, Module, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Stiller en delt Redis-forbindelse til rådighed (cache, rate limiting, kø).
 * Returnerer null når REDIS_URL ikke er sat, så lokal udvikling kan køre uden Redis.
 * VIGTIGT: en 'error'-lytter er påkrævet — ellers vil et forbindelses-error-event
 * vælte hele Node-processen (ioredis videresender til process som uncaught).
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis | null => {
        if (!process.env.REDIS_URL) return null;
        const client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
        client.on('error', (e) => new Logger('Redis').warn('Forbindelsesfejl: ' + (e?.message || e)));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
