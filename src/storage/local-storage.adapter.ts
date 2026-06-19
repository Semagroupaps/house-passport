import { Injectable } from '@nestjs/common';
import { StorageAdapter } from './storage.interface';

/** In-memory placeholder for S3. Erstattes af S3Adapter uden kerneændringer. */
@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, Buffer>();
  async put(key: string, bytes: Buffer): Promise<void> {
    this.store.set(key, bytes);
  }
  async get(key: string): Promise<Buffer> {
    const v = this.store.get(key);
    if (!v) throw new Error(`Objekt ikke fundet: ${key}`);
    return v;
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
