/** Besked-kø. Produktion: SQS/EventBridge. Her: in-memory til udvikling/test. */
export interface QueueAdapter {
  publish(topic: string, message: unknown): Promise<void>;
  subscribe(topic: string, handler: (message: any) => Promise<void>): void;
}
export const QUEUE_ADAPTER = Symbol('QUEUE_ADAPTER');
