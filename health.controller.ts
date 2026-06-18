import { Controller, Get, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  @Get()
  async check() {
    let db = 'down';
    let redis = 'disabled';
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      db = 'up';
    } catch {
      db = 'down';
    }
    if (this.redis) {
      try {
        await this.redis.ping();
        redis = 'up';
      } catch {
        redis = 'down';
      }
    }
    const status = db === 'up' && redis !== 'down' ? 'ok' : 'degraded';
    return { status, db, redis };
  }
}
