import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import { QueueAdapter, QueueStats, DeadLetterEntry } from './queue.interface';

const GROUP = 'hp-workers';
const MAX_DELIVERIES = 5;
const RECLAIM_IDLE_MS = 60_000;
const BLOCK_MS = 5_000;

/**
 * Durabel kø på Redis Streams. I modsætning til pub/sub er beskeder persistente:
 *  - XADD lægger beskeder i en stream (trimmes til ~10k).
 *  - En consumer group leverer hver besked til netop én worker (XREADGROUP '>').
 *  - XACK kvitterer FØRST når behandlingen lykkes -> intet tab ved crash midt i.
 *  - En reclaim-loop (XPENDING+XCLAIM) overtager beskeder, der har hængt for længe
 *    hos en død/genstartet worker, og prøver igen.
 *  - Efter MAX_DELIVERIES forsøg flyttes beskeden til en dead-letter-stream.
 * Skalerer vandret: flere instanser deler samme group og trækker hver sine beskeder.
 */
@Injectable()
export class RedisStreamsQueueAdapter implements QueueAdapter, OnModuleDestroy {
  private readonly logger = new Logger(RedisStreamsQueueAdapter.name);
  private readonly client: Redis;
  private readonly blocking: Redis;
  private readonly consumer = `${hostname()}-${process.pid}-${randomBytes(3).toString('hex')}`;
  private stopped = false;
  private readonly timers: NodeJS.Timeout[] = [];

  constructor() {
    const url = process.env.REDIS_URL as string;
    this.client = new Redis(url, { maxRetriesPerRequest: null });
    this.blocking = this.client.duplicate();
    // Uden 'error'-lytter ville et forbindelses-error-event vælte processen.
    this.client.on('error', (e: any) => this.logger.warn('Redis-fejl (client): ' + (e?.message || e)));
    this.blocking.on('error', (e: any) => this.logger.warn('Redis-fejl (blocking): ' + (e?.message || e)));
  }

  private streamKey(topic: string) { return `hp:stream:${topic}`; }
  private deadKey(topic: string) { return `hp:dead:${topic}`; }

  async publish(topic: string, message: unknown): Promise<void> {
    await (this.client as any).xadd(this.streamKey(topic), 'MAXLEN', '~', 10000, '*', 'data', JSON.stringify(message));
  }

  subscribe(topic: string, handler: (m: any) => Promise<void>): void {
    void this.start(topic, handler).catch((e) => this.logger.error(`Kunne ikke starte forbruger for "${topic}": ${String(e)}`));
  }

  private async ensureGroup(key: string): Promise<void> {
    try {
      await (this.client as any).xgroup('CREATE', key, GROUP, '0', 'MKSTREAM');
    } catch (e: any) {
      if (!String(e?.message || e).includes('BUSYGROUP')) throw e;
    }
  }

  private async start(topic: string, handler: (m: any) => Promise<void>): Promise<void> {
    const key = this.streamKey(topic);
    await this.ensureGroup(key);
    this.logger.log(`Lytter på "${topic}" som ${this.consumer}`);
    const t = setInterval(() => this.reclaim(topic, handler).catch((e) => this.logger.error(String(e))), RECLAIM_IDLE_MS);
    this.timers.push(t);
    void this.loop(topic, key, handler);
  }

  private async loop(topic: string, key: string, handler: (m: any) => Promise<void>): Promise<void> {
    while (!this.stopped) {
      try {
        const res: any = await (this.blocking as any).xreadgroup(
          'GROUP', GROUP, this.consumer, 'COUNT', 10, 'BLOCK', BLOCK_MS, 'STREAMS', key, '>',
        );
        if (!res) continue;
        const entries = res[0][1] as [string, string[]][];
        for (const [id, fields] of entries) await this.dispatch(topic, key, id, fields, handler, 1);
      } catch (e) {
        if (this.stopped) break;
        this.logger.error(`Læsefejl på "${topic}": ${String(e)}`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private async dispatch(
    topic: string, key: string, id: string, fields: string[],
    handler: (m: any) => Promise<void>, deliveries: number,
  ): Promise<void> {
    const i = fields.indexOf('data');
    const payload = i >= 0 ? fields[i + 1] : '{}';
    try {
      await handler(JSON.parse(payload));
      await (this.client as any).xack(key, GROUP, id);
    } catch (e) {
      this.logger.error(`Behandling fejlede (${id}, forsøg ${deliveries}) på "${topic}": ${String(e)}`);
      if (deliveries >= MAX_DELIVERIES) {
        await (this.client as any).xadd(this.deadKey(topic), '*', 'data', payload, 'origId', id, 'deliveries', String(deliveries));
        await (this.client as any).xack(key, GROUP, id);
        this.logger.warn(`Besked ${id} flyttet til dead-letter efter ${deliveries} forsøg`);
      }
      // ellers efterlades den pending -> reclaim prøver igen
    }
  }

  private async reclaim(topic: string, handler: (m: any) => Promise<void>): Promise<void> {
    const key = this.streamKey(topic);
    const pending: any = await (this.client as any).xpending(key, GROUP, 'IDLE', RECLAIM_IDLE_MS, '-', '+', 20);
    if (!Array.isArray(pending) || !pending.length) return;
    for (const entry of pending) {
      const id = entry[0];
      const deliveries = (Number(entry[3]) || 1) + 1;
      const claimed: any = await (this.client as any).xclaim(key, GROUP, this.consumer, RECLAIM_IDLE_MS, id);
      if (Array.isArray(claimed) && claimed.length) {
        const [cid, fields] = claimed[0];
        await this.dispatch(topic, key, cid, fields, handler, deliveries);
      }
    }
  }

  async stats(topic: string): Promise<QueueStats> {
    const key = this.streamKey(topic);
    try {
      const stream = Number(await (this.client as any).xlen(key)) || 0;
      let pending = 0;
      try { const p: any = await (this.client as any).xpending(key, GROUP); pending = Number(p?.[0]) || 0; } catch { /* gruppe findes ikke endnu */ }
      let deadLetter = 0;
      try { deadLetter = Number(await (this.client as any).xlen(this.deadKey(topic))) || 0; } catch { /* ingen dead-letter endnu */ }
      return { stream, pending, deadLetter };
    } catch {
      return { stream: 0, pending: 0, deadLetter: 0 };
    }
  }

  async listDeadLetter(topic: string, count = 50): Promise<DeadLetterEntry[]> {
    const rows: any = await (this.client as any).xrange(this.deadKey(topic), '-', '+', 'COUNT', count);
    if (!Array.isArray(rows)) return [];
    return rows.map(([id, fields]: [string, string[]]) => {
      const m: any = {};
      for (let i = 0; i < fields.length; i += 2) m[fields[i]] = fields[i + 1];
      return { id, payload: m.data, origId: m.origId, deliveries: m.deliveries ? Number(m.deliveries) : undefined };
    });
  }

  async requeueDeadLetter(topic: string, id: string): Promise<boolean> {
    const rows: any = await (this.client as any).xrange(this.deadKey(topic), id, id);
    if (!Array.isArray(rows) || !rows.length) return false;
    const fields: string[] = rows[0][1];
    const m: any = {};
    for (let i = 0; i < fields.length; i += 2) m[fields[i]] = fields[i + 1];
    if (m.data) await (this.client as any).xadd(this.streamKey(topic), 'MAXLEN', '~', 10000, '*', 'data', m.data);
    await (this.client as any).xdel(this.deadKey(topic), id);
    return true;
  }

  async discardDeadLetter(topic: string, id: string): Promise<boolean> {
    await (this.client as any).xdel(this.deadKey(topic), id);
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    for (const t of this.timers) clearInterval(t);
    try { this.blocking.disconnect(); } catch { /* ignore */ }
    try { this.client.disconnect(); } catch { /* ignore */ }
  }
}
