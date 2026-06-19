import { Injectable, Logger } from '@nestjs/common';
import { StorageAdapter } from './storage.interface';
import { signS3Request } from './sigv4';

/**
 * S3-kompatibelt blob-lager (AWS S3, MinIO, Cloudflare R2, Backblaze, Coolify MinIO).
 * Konfigureres via S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 * S3_REGION (default us-east-1), S3_FORCE_PATH_STYLE (default true).
 * Gemmer KUN allerede-krypteret ciphertext (envelope-kryptering sker før put).
 */
@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly endpoint = process.env.S3_ENDPOINT || '';
  private readonly bucket = process.env.S3_BUCKET || '';
  private readonly region = process.env.S3_REGION || 'us-east-1';
  private readonly accessKeyId = process.env.S3_ACCESS_KEY_ID || '';
  private readonly secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || '';
  private readonly pathStyle = (process.env.S3_FORCE_PATH_STYLE || 'true') !== 'false';

  static isConfigured(): boolean {
    return !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
  }

  private sign(method: string, key: string, body: Buffer, extra?: Record<string, string>) {
    return signS3Request({
      method, endpoint: this.endpoint, bucket: this.bucket, key,
      region: this.region, accessKeyId: this.accessKeyId, secretAccessKey: this.secretAccessKey,
      body, pathStyle: this.pathStyle, extraHeaders: extra,
    });
  }

  /** Fjerner host (fetch sætter den selv) men beholder de øvrige signerede headers. */
  private fetchHeaders(headers: Record<string, string>): Record<string, string> {
    const { host, ...rest } = headers;
    return rest;
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const { url, headers } = this.sign('PUT', key, bytes, { 'content-type': 'application/octet-stream' });
    const r = await fetch(url, { method: 'PUT', headers: this.fetchHeaders(headers), body: bytes });
    if (!r.ok) throw new Error('S3 put ' + r.status + ' ' + (await r.text().catch(() => '')));
  }

  async get(key: string): Promise<Buffer> {
    const { url, headers } = this.sign('GET', key, Buffer.alloc(0));
    const r = await fetch(url, { method: 'GET', headers: this.fetchHeaders(headers) });
    if (!r.ok) throw new Error('S3 get ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const { url, headers } = this.sign('DELETE', key, Buffer.alloc(0));
    const r = await fetch(url, { method: 'DELETE', headers: this.fetchHeaders(headers) });
    if (!r.ok && r.status !== 404) throw new Error('S3 delete ' + r.status);
  }
}
