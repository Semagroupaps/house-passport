import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantService } from '../tenant/tenant.service';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Deling af en bolig via AccessGrant (samtykke-baseret commons). RLS håndhæver, at
 * KUN den nuværende ejer kan uddele/fjerne adgang (grant_insert/grant_delete).
 * E-mail -> person opslås via admin-forbindelsen (uden for RLS), præcis som auth;
 * selve grant-operationerne kører i ejerens tenant-kontekst, så RLS bevares.
 */
@Injectable()
export class SharingService implements OnModuleDestroy {
  private readonly admin = new PrismaClient({ datasources: { db: { url: process.env.ADMIN_DATABASE_URL } } });

  constructor(private readonly tenant: TenantService) {}

  private scopesFor(role: 'read' | 'write'): string[] {
    return role === 'write' ? ['documents:read', 'documents:write'] : ['documents:read'];
  }

  async share(ctx: TenantContext, propertyId: string, email: string, role: 'read' | 'write') {
    const mail = (email || '').trim().toLowerCase();
    if (!mail.includes('@')) throw new BadRequestException('Ugyldig e-mail');
    const person = await (this.admin as any).person.findUnique({ where: { email: mail } });
    if (!person) throw new NotFoundException('Ingen bruger med den e-mail. Bed personen oprette en konto først.');
    if (person.id === ctx.personId) throw new BadRequestException('Du har allerede adgang til din egen bolig');

    return this.tenant.withTenant(ctx, async (tx) => {
      const existing = await tx.accessGrant.findFirst({
        where: { propertyId, subjectType: 'person', subjectId: person.id, validTo: null },
      });
      if (existing) await tx.accessGrant.delete({ where: { id: existing.id } });

      const grant = await tx.accessGrant.create({
        data: {
          propertyId, subjectType: 'person', subjectId: person.id,
          scope: this.scopesFor(role), permission: role === 'write' ? 'write' : 'read',
          grantedBy: ctx.personId as string,
        },
      });
      return { id: grant.id, email: mail, name: person.displayName, permission: grant.permission, scope: grant.scope };
    });
  }

  async list(ctx: TenantContext, propertyId: string) {
    const grants: any[] = await this.tenant.withTenant(ctx, async (tx) =>
      tx.accessGrant.findMany({
        where: { propertyId, subjectType: 'person', validTo: null },
        orderBy: { createdAt: 'desc' },
      }),
    );
    const ids = [...new Set(grants.map((g) => g.subjectId))];
    const people: any[] = ids.length ? await (this.admin as any).person.findMany({ where: { id: { in: ids } } }) : [];
    const byId = new Map(people.map((p) => [p.id, p]));
    return grants.map((g) => ({
      id: g.id,
      email: byId.get(g.subjectId)?.email ?? null,
      name: byId.get(g.subjectId)?.displayName ?? null,
      permission: g.permission,
      scope: g.scope,
      createdAt: g.createdAt,
    }));
  }

  async revoke(ctx: TenantContext, propertyId: string, grantId: string) {
    return this.tenant.withTenant(ctx, async (tx) => {
      const g = await tx.accessGrant.findUnique({ where: { id: grantId } });
      if (!g || g.propertyId !== propertyId) throw new NotFoundException();
      await tx.accessGrant.delete({ where: { id: grantId } });
      return { id: grantId, revoked: true };
    });
  }

  async onModuleDestroy() {
    await this.admin.$disconnect();
  }
}
