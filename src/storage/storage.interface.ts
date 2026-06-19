/** Blob-lager. DK-default: AWS S3 (EU-region). Her: lokal in-memory til udvikling. */
export interface StorageAdapter {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');

/** KMS-bagudvendt nøglehåndtering. Muliggør crypto-shredding (destruér nøgle). */
export interface KmsAdapter {
  generateDataKey(): Promise<{ dataKey: Buffer; keyRef: string }>;
  decryptDataKey(keyRef: string): Promise<Buffer | null>;
  shred(keyRef: string): Promise<void>;
}
export const KMS_ADAPTER = Symbol('KMS_ADAPTER');
