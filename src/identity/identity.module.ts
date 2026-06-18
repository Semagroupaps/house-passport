import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { MITID_BROKER } from './mitid-broker.interface';
import { MockMitIdBroker } from './mock-mitid-broker';
import { TenantModule } from '../tenant/tenant.module';
import { RegistryModule } from '../registry/registry.module';

@Module({
  imports: [TenantModule, RegistryModule],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    { provide: MITID_BROKER, useClass: MockMitIdBroker },
  ],
})
export class IdentityModule {}
