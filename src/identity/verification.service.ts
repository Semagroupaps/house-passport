import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { TenantContext } from '../tenant/tenant-context';
import { MITID_BROKER, MitIdBroker } from './mitid-broker.interface';
import { OWNERSHIP_REGISTRY, OwnershipRegistryAdapter } from '../registry/ownership-registry.interface';
import { matchesRegisteredOwner } from './ownership-matching';

/**
 * Ejerverificering: at logge ind != at bevise ejerskab. Først når den
 * MitID-verificerede identitet matcher den registrerede ejer af BFE-nummeret,
 * sættes ownership_period.mitid_verified = true. Det er dét flag, der gør
 * dataene B2B-værdifulde og låser op for ejerskifte (Trin 9.2).
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly tenant: TenantService,
    @Inject(MITID_BROKER) private readonly broker: MitIdBroker,
    @Inject(OWNERSHIP_REGISTRY) private readonly ownerRegistry: OwnershipRegistryAdapter,
  ) {}

  initiate() {
    return this.broker.initiate();
  }

  async complete(ctx: TenantContext, propertyId: string, brokerCode: string) {
    const identity = await this.broker.complete(brokerCode);
    if (identity.assuranceLevel !== 'high') {
      throw new ForbiddenException('Utilstrækkeligt MitID-sikkerhedsniveau');
    }
    return this.tenant.withTenant(ctx, async (tx) => {
      const property = await tx.property.findUnique({ where: { id: propertyId } });
      if (!property) throw new NotFoundException();

      const owners = await this.ownerRegistry.lookupOwner(property.bfeNumber);
      if (!matchesRegisteredOwner(identity.authoritativeId, owners)) {
        throw new ForbiddenException('MitID-identitet matcher ikke den registrerede ejer');
      }

      await tx.ownershipPeriod.updateMany({
        where: { propertyId, personId: ctx.personId as string, validTo: null },
        data: { mitidVerified: true },
      });
      await tx.person.update({
        where: { id: ctx.personId as string },
        data: { isMitidVerified: true },
      });
      return { verified: true, propertyId, name: identity.name };
    });
  }
}
