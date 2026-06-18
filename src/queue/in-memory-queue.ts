import { Injectable, Logger } from '@nestjs/common';
import { QueueAdapter } from './queue.interface';

/**
 * Async in-memory kø. Leverer beskeder via setImmediate (afkoblet fra request).
 * Fejl logges som dead-letter-kandidater. Erstattes af SQS/EventBridge-adapter.
 */
@Injectable()
export class InMemoryQueue implements QueueAdapter {
  private readonly logger = new Logger(InMemoryQueue.name);
  private readonly handlers = new Map<string, ((m: any) => Promise<void>)[]>();

  async publish(topic: string, message: unknown): Promise<void> {
    const hs = this.handlers.get(topic) ?? [];
    for (const h of hs) {
      setImmediate(() => {
        h(message).catch((e) =>
          this.logger.error(`Dead-letter på "${topic}": ${String(e)}`),
        );
      });
    }
  }

  subscribe(topic: string, handler: (m: any) => Promise<void>): void {
    const hs = this.handlers.get(topic) ?? [];
    hs.push(handler);
    this.handlers.set(topic, hs);
  }
}
