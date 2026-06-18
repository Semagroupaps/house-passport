import { Module } from '@nestjs/common';
import { QUEUE_ADAPTER } from './queue.interface';
import { InMemoryQueue } from './in-memory-queue';
import { RedisQueueAdapter } from './redis-queue.adapter';

@Module({
  providers: [
    {
      provide: QUEUE_ADAPTER,
      // Redis i produktion (Coolify), in-memory lokalt/test.
      useFactory: () =>
        process.env.REDIS_URL ? new RedisQueueAdapter(process.env.REDIS_URL) : new InMemoryQueue(),
    },
  ],
  exports: [QUEUE_ADAPTER],
})
export class QueueModule {}
