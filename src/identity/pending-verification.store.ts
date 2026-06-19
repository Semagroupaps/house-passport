import { Injectable } from '@nestjs/common';

interface Pending { personId: string; propertyId: string; codeVerifier: string; nonce: string; exp: number; }

/** Korrelerer initiate -> callback. In-memory (single instance); flyt til Redis ved skalering. */
@Injectable()
export class PendingVerificationStore {
  private map = new Map<string, Pending>();

  put(state: string, p: Omit<Pending, 'exp'>, ttlMs = 10 * 60 * 1000): void {
    this.map.set(state, { ...p, exp: Date.now() + ttlMs });
  }
  take(state: string): Pending | null {
    const v = this.map.get(state);
    if (v) this.map.delete(state);
    if (!v || v.exp < Date.now()) return null;
    return v;
  }
}
