import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { KmsAdapter } from './storage.interface';

/**
 * In-memory placeholder for AWS KMS. Datanøgler opbevares her under en keyRef.
 * shred() sletter nøglen permanent -> al ciphertext krypteret med den bliver
 * uigenkaldeligt ulæselig, OGSÅ i backups (crypto-shredding, Trin 6.6).
 */
@Injectable()
export class LocalKmsAdapter implements KmsAdapter {
  private readonly keys = new Map<string, Buffer>();
  async generateDataKey(): Promise<{ dataKey: Buffer; keyRef: string }> {
    const dataKey = randomBytes(32); // AES-256
    const keyRef = randomUUID();
    this.keys.set(keyRef, dataKey);
    return { dataKey, keyRef };
  }
  async decryptDataKey(keyRef: string): Promise<Buffer | null> {
    return this.keys.get(keyRef) ?? null;
  }
  async shred(keyRef: string): Promise<void> {
    this.keys.delete(keyRef);
  }
}
