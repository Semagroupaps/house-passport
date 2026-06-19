import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { TenantContext } from '../tenant/tenant-context';
import { REGISTRY_ADAPTER, RegistryAdapter } from '../registry/registry.interface';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly tenant: TenantService,
    @Inject(REGISTRY_ADAPTER) private readonly registry: RegistryAdapter,
  ) {}

  /** Returnerer KUN boliger, som RLS tillader — beriget med ejerens verificeret-flag. */
  async listVisible(ctx: TenantContext) {
    return this.tenant.withTenant(ctx, async (tx) => {
      const props = await tx.property.findMany();
      const owns = await tx.ownershipPeriod.findMany({
        where: { personId: ctx.personId as string, validTo: null },
      });
      const verifiedByProperty = new Map(owns.map((o: any) => [o.propertyId, o.mitidVerified]));
      return props.map((p: any) => ({ ...p, verified: verifiedByProperty.get(p.id) ?? false }));
    });
  }

  /** Returnerer KUN dokumenter, som RLS tillader (ejerskab eller læse-grant). */
  async listDocuments(ctx: TenantContext, propertyId: string) {
    return this.tenant.withTenant(ctx, (tx) =>
      tx.document.findMany({ where: { propertyId } }),
    );
  }

  /**
   * Samlet oversigt for én bolig: beregnet vedligeholdelsesscore, dokument-status,
   * opgaver, garantier og en tidslinje — alt i én RLS-scoped transaktion.
   */
  async overview(ctx: TenantContext, propertyId: string) {
    return this.tenant.withTenant(ctx, async (tx) => {
      const anyTx = tx as any;
      const property = await tx.property.findUnique({ where: { id: propertyId } });
      if (!property) return null; // skjult af RLS eller findes ikke

      const [docs, tasks, warranties, ownerships] = await Promise.all([
        tx.document.findMany({ where: { propertyId }, orderBy: { createdAt: 'desc' } }),
        anyTx.maintenanceTask.findMany({ where: { propertyId } }),
        anyTx.warranty.findMany({ where: { propertyId } }),
        tx.ownershipPeriod.findMany({ where: { propertyId } }),
      ]);

      const now = Date.now();
      const total = docs.length;
      const processed = docs.filter((d: any) => d.processingStatus === 'processed').length;
      const openTasks = tasks.filter((t: any) => t.status === 'open');
      const overdue = openTasks.filter((t: any) => t.dueDate && new Date(t.dueDate).getTime() < now).length;
      const upcoming = [...openTasks]
        .sort((a: any, b: any) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity))
        .slice(0, 6);
      const activeWarranties = warranties.filter((w: any) => !w.endDate || new Date(w.endDate).getTime() > now);
      const mine = ownerships.find((o: any) => o.personId === ctx.personId && !o.validTo);
      const verified = !!mine?.mitidVerified;

      let score = 20;
      score += verified ? 25 : 0;
      score += Math.min(35, processed * 5);
      score += Math.min(20, activeWarranties.length * 7);
      score -= overdue * 8;
      score = Math.max(0, Math.min(100, score));

      const grade = total ? Math.round((processed / total) * 100) : 0;

      const timeline = [
        ...docs.map((d: any) => ({ type: 'document', label: `Dokument tilføjet: ${d.filename ?? 'Dokument'}`, date: d.createdAt })),
        ...tasks.filter((t: any) => t.completedAt).map((t: any) => ({ type: 'task', label: `Opgave fuldført: ${t.title}`, date: t.completedAt })),
        ...ownerships.map((o: any) => ({ type: 'ownership', label: o.validTo ? 'Ejerskab afsluttet' : 'Ejerskab registreret', date: o.validFrom })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      return {
        property: { ...property, verified },
        score,
        documents: { total, processed, pending: total - processed, grade },
        tasks: { open: openTasks.length, overdue, upcoming },
        warranties: { active: activeWarranties.length, items: warranties },
        timeline,
      };
    });
  }

  /** Henter friske oplysninger fra BBR/registret på boligens adresse og opdaterer den. */
  async refreshBbr(ctx: TenantContext, propertyId: string) {
    return this.tenant.withTenant(ctx, async (tx) => {
      const property = await tx.property.findUnique({ where: { id: propertyId } });
      if (!property) throw new NotFoundException();
      const data = await this.registry.lookupByAddress(property.address);
      return tx.property.update({
        where: { id: propertyId },
        data: {
          energyLabel: data.energyLabel ?? property.energyLabel,
          propertyType: data.propertyType ?? property.propertyType,
          buildYear: data.buildYear ?? property.buildYear,
          bbrSnapshot: data.bbrSnapshot as any,
        },
      });
    });
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

}
