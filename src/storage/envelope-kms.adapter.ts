import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { KmsAdapter } from './storage.interface';

/**
 * Durabel KMS: datanøglen pakkes ind (AES-256-GCM) med en master-nøgle afledt af
 * KMS_MASTER_KEY og returneres som keyRef, der lagres i DB'en (document.encryption_key_ref).
 * I modsætning til in-memory-varianten overlever nøglerne genstart.
 *
 * Crypto-shredding: indholdet kan kun dekrypteres via den indpakkede nøgle i DB-rækken.
 * Når documents.shred nulstiller key_ref, er datanøglen permanent væk — også i backups
 * af blob-laget. (Til fuld AWS KMS: udskift wrap/unwrap med KMS Encrypt/Decrypt.)
 */
@Injectable()
export class EnvelopeKmsAdapter implements KmsAdapter {
  private readonly master = createHash('sha256').update(process.env.KMS_MASTER_KEY || '').digest();

  static isConfigured(): boolean {
    return !!process.env.KMS_MASTER_KEY;
  }

  async generateDataKey(): Promise<{ dataKey: Buffer; keyRef: string }> {
    const dataKey = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.master, iv);
    const enc = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    const keyRef = Buffer.concat([iv, tag, enc]).toString('base64');
    return { dataKey, keyRef };
  }

  async decryptDataKey(keyRef: string): Promise<Buffer | null> {
    if (!keyRef) return null;
    try {
      const wrapped = Buffer.from(keyRef, 'base64');
      const iv = wrapped.subarray(0, 12);
      const tag = wrapped.subarray(12, 28);
      const enc = wrapped.subarray(28);
      const decipher = createDecipheriv('aes-256-gcm', this.master, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]);
    } catch {
      return null; // shreddet eller korrupt
    }
  }

  async shred(): Promise<void> {
    // Destruktion sker ved at slette key_ref i DB-rækken; ingen ekstra kopi at fjerne.
  }
}
