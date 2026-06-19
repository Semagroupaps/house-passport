import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { MitIdCallbackController } from './mitid-callback.controller';
import { VerificationService } from './verification.service';
import { MITID_BROKER } from './mitid-broker.interface';
import { OidcMitIdBroker } from './oidc-mitid-broker';
import { SimulatedMitIdBroker } from './simulated-mitid-broker';
import { PendingVerificationStore } from './pending-verification.store';
import { TenantModule } from '../tenant/tenant.module';
import { RegistryModule } from '../registry/registry.module';

@Module({
  imports: [TenantModule, RegistryModule],
  controllers: [VerificationController, MitIdCallbackController],
  providers: [
    VerificationService,
    PendingVerificationStore,
    OidcMitIdBroker,
    SimulatedMitIdBroker,
    // OIDC i produktion (når MITID_* er sat), ellers simuleret.
    {
      provide: MITID_BROKER,
      useFactory: (oidc: OidcMitIdBroker, sim: SimulatedMitIdBroker) =>
        oidc.isConfigured() ? oidc : sim,
      inject: [OidcMitIdBroker, SimulatedMitIdBroker],
    },
  ],
})
export class IdentityModule {}
