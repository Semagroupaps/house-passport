import { Module } from '@nestjs/common';
import { REGISTRY_ADAPTER } from './registry.interface';
import { OWNERSHIP_REGISTRY } from './ownership-registry.interface';
import { DawaAddressService } from './dawa-address.service';
import { DatafordelerClient } from './datafordeler.client';
import { DarBfeResolver } from './dar-bfe.resolver';
import { DatafordelerBbrAdapter } from './datafordeler-bbr.adapter';
import { DatafordelerEjerfortegnelseAdapter } from './datafordeler-ejerfortegnelse.adapter';
import { RegistryController } from './registry.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule], // for AuthGuard-kontekst via middleware (PrismaService ej nødvendig her)
  controllers: [RegistryController],
  providers: [
    DawaAddressService,
    DatafordelerClient,
    DarBfeResolver,
    DatafordelerBbrAdapter,
    DatafordelerEjerfortegnelseAdapter,
    { provide: REGISTRY_ADAPTER, useExisting: DatafordelerBbrAdapter },
    { provide: OWNERSHIP_REGISTRY, useExisting: DatafordelerEjerfortegnelseAdapter },
  ],
  exports: [REGISTRY_ADAPTER, OWNERSHIP_REGISTRY, DawaAddressService],
})
export class RegistryModule {}
