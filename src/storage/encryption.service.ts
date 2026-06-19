import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { KMS_ADAPTER, KmsAdapter } from './storage.interface';

/**
 * Envelope-kryptering pr. dokument med AES-256-GCM.
 * Ciphertext (iv|tag|data) lagres i storage; datanøglen ligger KUN i KMS under
 * keyRef. Sletning = kms.shred(keyRef) -> indholdet kan aldrig dekrypteres igen.
 */
@Injectable()
export class EncryptionService {
  constructor(@Inject(KMS_ADAPTER) private readonly kms: KmsAdapter) {}

  async encrypt(plaintext: Buffer): Promise<{ ciphertext: Buffer; keyRef: string }> {
    const { dataKey, keyRef } = await this.kms.generateDataKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
    const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext: Buffer.concat([iv, tag, enc]), keyRef };
  }

  async decrypt(blob: Buffer, keyRef: string): Promise<Buffer> {
    const dataKey = await this.kms.decryptDataKey(keyRef);
    if (!dataKey) {
      throw new Error('Nøgle destrueret — indholdet er permanent ulæseligt');
    }
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const enc = blob.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', dataKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }

  async shred(keyRef: string): Promise<void> {
    await this.kms.shred(keyRef);
  }
}
