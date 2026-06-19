import { Module } from '@nestjs/common';
import { QUEUE_ADAPTER } from './queue.interface';
import { InMemoryQueue } from './in-memory-queue';
import { RedisStreamsQueueAdapter } from './redis-streams-queue.adapter';

@Module({
  providers: [
    {
      provide: QUEUE_ADAPTER,
      // Durabel Redis Streams-kø i produktion (Coolify), in-memory lokalt/test.
      useClass: process.env.REDIS_URL ? RedisStreamsQueueAdapter : InMemoryQueue,
    },
  ],
  exports: [QUEUE_ADAPTER],
})
export class QueueModule {}
