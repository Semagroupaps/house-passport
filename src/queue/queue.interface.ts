export interface QueueStats { stream: number; pending: number; deadLetter: number }
export interface DeadLetterEntry { id: string; payload: string; origId?: string; deliveries?: number }

/** Besked-kø. Produktion: durabel Redis Streams-kø. Her: in-memory til udvikling/test. */
export interface QueueAdapter {
  publish(topic: string, message: unknown): Promise<void>;
  subscribe(topic: string, handler: (message: any) => Promise<void>): void;
  stats(topic: string): Promise<QueueStats>;
  listDeadLetter(topic: string, count?: number): Promise<DeadLetterEntry[]>;
  requeueDeadLetter(topic: string, id: string): Promise<boolean>;
  discardDeadLetter(topic: string, id: string): Promise<boolean>;
}
export const QUEUE_ADAPTER = Symbol('QUEUE_ADAPTER');
