import { Module } from '@nestjs/common';
import { STORAGE_ADAPTER, KMS_ADAPTER } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';
import { LocalKmsAdapter } from './local-kms.adapter';
import { EncryptionService } from './encryption.service';

@Module({
  providers: [
    { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
    { provide: KMS_ADAPTER, useClass: LocalKmsAdapter },
    EncryptionService,
  ],
  exports: [STORAGE_ADAPTER, EncryptionService],
})
export class StorageModule {}
