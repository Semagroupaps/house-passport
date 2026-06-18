import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { QueueAdapter } from './queue.interface';

/**
 * Redis pub/sub-baseret kø til produktion (Coolify provisionerer Redis).
 * Bemærk: pub/sub giver fan-out; ved flere worker-instanser bør dette
 * opgraderes til BullMQ for holdbar, exactly-once-levering. Workeren er
 * idempotent, så gentagne leveringer ikke duplikerer arbejde.
 */
export class RedisQueueAdapter implements QueueAdapter {
  private readonly logger = new Logger(RedisQueueAdapter.name);
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly handlers = new Map<string, ((m: any) => Promise<void>)[]>();

  constructor(url: string) {
    this.pub = new Redis(url, { maxRetriesPerRequest: null });
    this.sub = new Redis(url, { maxRetriesPerRequest: null });
    this.sub.on('message', (channel: string, payload: string) => {
      const hs = this.handlers.get(channel) ?? [];
      for (const h of hs) {
        h(JSON.parse(payload)).catch((e) =>
          this.logger.error(`Dead-letter på "${channel}": ${String(e)}`),
        );
      }
    });
  }

  async publish(topic: string, message: unknown): Promise<void> {
    await this.pub.publish(topic, JSON.stringify(message));
  }

  subscribe(topic: string, handler: (m: any) => Promise<void>): void {
    const hs = this.handlers.get(topic) ?? [];
    hs.push(handler);
    this.handlers.set(topic, hs);
    void this.sub.subscribe(topic);
  }
}
