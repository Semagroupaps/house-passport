import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Ejerskifte ved salg — moaten. Et tilbud-/accept-flow: sælger tilbyder boligen til
 * en købers e-mail; køber accepterer; boligen overdrages MED hele servicebogen
 * (dokumenter, vedligehold, garantier bliver på boligen = gratis onboarding af køber).
 *
 * Overdragelsen er en privilegeret, fler-parts-transaktion (to forskellige aktører
 * skriver), så den udføres atomisk via admin-forbindelsen, mens autorisationen
 * håndhæves eksplicit i koden: kun den nuværende, MitID-verificerede ejer kan tilbyde,
 * og kun den udpegede køber kan acceptere.
 */
@Injectable()
export class TransferService implements OnModuleDestroy {
  private readonly db = new PrismaClient({ datasources: { db: { url: process.env.ADMIN_DATABASE_URL } } });

  private async caller(ctx: TenantContext): Promise<{ id: string; email: string | null; name: string | null }> {
    const id = ctx.personId as string;
    const p: any = await (this.db as any).person.findUnique({ where: { id } });
    return { id, email: p?.email ?? null, name: p?.displayName ?? null };
  }

  /** Sælger tilbyder boligen til en købers e-mail. */
  async initiate(ctx: TenantContext, propertyId: string, buyerEmail: string, saleDateStr?: string) {
    const me = await this.caller(ctx);
    const op: any = await (this.db as any).ownershipPeriod.findFirst({
      where: { propertyId, personId: me.id, validTo: null },
    });
    if (!op) throw new ForbiddenException('Kun den nuværende ejer kan overdrage boligen');
    if (!op.mitidVerified) throw new ForbiddenException('Ejerskab skal være MitID-verificeret før overdragelse');

    const mail = (buyerEmail || '').trim().toLowerCase();
    if (!mail.includes('@')) throw new BadRequestException('Ugyldig købers e-mail');
    const buyer: any = await (this.db as any).person.findUnique({ where: { email: mail } });
    if (buyer && buyer.id === me.id) throw new BadRequestException('Du kan ikke overdrage til dig selv');

    const saleDate = saleDateStr ? new Date(saleDateStr) : new Date();
    if (isNaN(saleDate.getTime())) throw new BadRequestException('Ugyldig salgsdato');

    // Erstat evt. tidligere åbent tilbud på samme bolig.
    await (this.db as any).propertyTransfer.updateMany({
      where: { propertyId, status: 'pending' }, data: { status: 'superseded' },
    });

    const t: any = await (this.db as any).propertyTransfer.create({
      data: { propertyId, fromPersonId: me.id, toEmail: mail, toPersonId: buyer?.id ?? null, saleDate, status: 'pending' },
    });
    return { id: t.id, propertyId, toEmail: mail, status: t.status, buyerHasAccount: !!buyer };
  }

  /** Tilbud, der er rettet til den indloggede bruger (køber-visning). */
  async incoming(ctx: TenantContext) {
    const me = await this.caller(ctx);
    const where: any = { status: 'pending', OR: [{ toPersonId: me.id }] as any[] };
    if (me.email) where.OR.push({ toEmail: me.email });
    const rows: any[] = await (this.db as any).propertyTransfer.findMany({ where, orderBy: { createdAt: 'desc' } });
    return Promise.all(rows.map(async (t) => {
      const prop: any = await (this.db as any).property.findUnique({ where: { id: t.propertyId } });
      const seller: any = await (this.db as any).person.findUnique({ where: { id: t.fromPersonId } });
      return { id: t.id, propertyId: t.propertyId, address: prop?.address ?? null, sellerName: seller?.displayName ?? null, saleDate: t.saleDate };
    }));
  }

  /** Tilbud, den indloggede bruger har sendt (sælger-visning). */
  async outgoing(ctx: TenantContext, propertyId?: string) {
    const me = await this.caller(ctx);
    const where: any = { fromPersonId: me.id, status: 'pending' };
    if (propertyId) where.propertyId = propertyId;
    const rows: any[] = await (this.db as any).propertyTransfer.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rows.map((t) => ({ id: t.id, propertyId: t.propertyId, toEmail: t.toEmail, saleDate: t.saleDate, status: t.status }));
  }

  /** Køber accepterer: atomisk overdragelse. */
  async accept(ctx: TenantContext, transferId: string) {
    const me = await this.caller(ctx);
    const t: any = await (this.db as any).propertyTransfer.findUnique({ where: { id: transferId } });
    if (!t || t.status !== 'pending') throw new NotFoundException('Tilbuddet findes ikke eller er ikke længere aktivt');
    const isRecipient = t.toPersonId ? t.toPersonId === me.id : (me.email && t.toEmail === me.email);
    if (!isRecipient) throw new ForbiddenException('Tilbuddet er ikke rettet til dig');
    if (t.fromPersonId === me.id) throw new BadRequestException('Du kan ikke acceptere din egen overdragelse');

    await (this.db as any).$transaction(async (tx: any) => {
      // 1) Luk sælgers ejerskabsperiode.
      await tx.ownershipPeriod.updateMany({
        where: { propertyId: t.propertyId, personId: t.fromPersonId, validTo: null },
        data: { validTo: t.saleDate },
      });
      // 2) Åbn købers ejerskabsperiode (skal MitID-verificeres på ny).
      await tx.ownershipPeriod.create({
        data: { propertyId: t.propertyId, personId: me.id, validFrom: t.saleDate, validTo: null, mitidVerified: false },
      });
      // 3) Tilbagekald sælgers delinger (ny ejer starter på en ren tavle).
      await tx.accessGrant.updateMany({
        where: { propertyId: t.propertyId, validTo: null }, data: { validTo: new Date() },
      });
      // 4) Markér tilbuddet gennemført.
      await tx.propertyTransfer.update({
        where: { id: t.id }, data: { status: 'accepted', toPersonId: me.id, completedAt: new Date() },
      });
    });
    return { id: t.id, propertyId: t.propertyId, accepted: true };
  }

  /** Sælger annullerer et åbent tilbud. */
  async cancel(ctx: TenantContext, transferId: string) {
    const me = await this.caller(ctx);
    const t: any = await (this.db as any).propertyTransfer.findUnique({ where: { id: transferId } });
    if (!t) throw new NotFoundException();
    if (t.fromPersonId !== me.id) throw new ForbiddenException('Kun afsenderen kan annullere');
    if (t.status !== 'pending') throw new BadRequestException('Tilbuddet er ikke længere aktivt');
    await (this.db as any).propertyTransfer.update({ where: { id: t.id }, data: { status: 'cancelled' } });
    return { id: t.id, cancelled: true };
  }

  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}
