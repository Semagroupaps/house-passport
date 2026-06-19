import { Module } from '@nestjs/common';
import { STORAGE_ADAPTER, KMS_ADAPTER } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';
import { LocalKmsAdapter } from './local-kms.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { EnvelopeKmsAdapter } from './envelope-kms.adapter';
import { EncryptionService } from './encryption.service';

@Module({
  providers: [
    { provide: STORAGE_ADAPTER, useClass: S3StorageAdapter.isConfigured() ? S3StorageAdapter : LocalStorageAdapter },
    { provide: KMS_ADAPTER, useClass: EnvelopeKmsAdapter.isConfigured() ? EnvelopeKmsAdapter : LocalKmsAdapter },
    EncryptionService,
  ],
  exports: [STORAGE_ADAPTER, EncryptionService],
})
export class StorageModule {}
