import { Module } from '@nestjs/common';
import { REGISTRY_ADAPTER } from './registry.interface';
import { MockBbrAdapter } from './mock-bbr.adapter';
import { OWNERSHIP_REGISTRY } from './ownership-registry.interface';
import { MockOwnershipRegistry } from './mock-ownership-registry';

@Module({
  providers: [
    { provide: REGISTRY_ADAPTER, useClass: MockBbrAdapter },
    { provide: OWNERSHIP_REGISTRY, useClass: MockOwnershipRegistry },
  ],
  exports: [REGISTRY_ADAPTER, OWNERSHIP_REGISTRY],
})
export class RegistryModule {}
