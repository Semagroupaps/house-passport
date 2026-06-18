import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { TenantContext } from '../tenant/tenant-context';
import { REGISTRY_ADAPTER, RegistryAdapter } from '../registry/registry.interface';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly tenant: TenantService,
    @Inject(REGISTRY_ADAPTER) private readonly registry: RegistryAdapter,
  ) {}

  /** Returnerer KUN boliger, som RLS tillader for den givne kontekst. */
  async listVisible(ctx: TenantContext) {
    return this.tenant.withTenant(ctx, (tx) => tx.property.findMany());
  }

  /** Returnerer KUN dokumenter, som RLS tillader (ejerskab eller læse-grant). */
  async listDocuments(ctx: TenantContext, propertyId: string) {
    return this.tenant.withTenant(ctx, (tx) =>
      tx.document.findMany({ where: { propertyId } }),
    );
  }

  /**
   * Onboarding (Trin 1): adresse -> registeropslag -> opret bolig + UVERIFICERET
   * ejerskab i én transaktion. WITH CHECK-policies sikrer, at man kun kan gøre
   * sig selv til ejer. MitID-verificering er et senere, separat step (Trin 9.2).
   */
  async createFromAddress(ctx: TenantContext, address: string) {
    const data = await this.registry.lookupByAddress(address);
    return this.tenant.withTenant(ctx, async (tx) => {
      const property = await tx.property.create({
        data: {
          bfeNumber: data.bfeNumber,
          address: data.address,
          energyLabel: data.energyLabel,
          propertyType: data.propertyType,
          buildYear: data.buildYear,
          // JSON-blob fra registeret; Prisma's InputJsonValue er først tilgængelig efter generate
          bbrSnapshot: data.bbrSnapshot as any,
        },
      });
      await tx.ownershipPeriod.create({
        data: {
          propertyId: property.id,
          personId: ctx.personId as string,
          validFrom: new Date(),
          mitidVerified: false,
        },
      });
      return property;
    });
  }

  /**
   * Ejerskifte (salg). Kræver at aktøren er den NUVÆRENDE og MitID-VERIFICEREDE
   * ejer. Lukker ejerskabsperioden; boligen og dens transferable historik
   * forbliver på boligen, så den nye ejer onboardes gratis (Trin 5.4 — moaten).
   */
  async transfer(ctx: TenantContext, propertyId: string, saleDate: Date) {
    return this.tenant.withTenant(ctx, async (tx) => {
      const op = await tx.ownershipPeriod.findFirst({
        where: { propertyId, personId: ctx.personId as string, validTo: null },
      });
      if (!op) {
        throw new ForbiddenException('Kun den nuværende ejer kan overdrage boligen');
      }
      if (!op.mitidVerified) {
        throw new ForbiddenException('Ejerskab skal være MitID-verificeret før overdragelse');
      }
      await tx.ownershipPeriod.update({
        where: { id: op.id },
        data: { validTo: saleDate },
      });
      return { propertyId, transferredAt: saleDate };
    });
  }
}
