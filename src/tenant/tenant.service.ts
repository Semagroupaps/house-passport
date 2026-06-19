import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from './tenant-context';

export type Tx = Prisma.TransactionClient;

/**
 * Kører alt dataarbejde i ÉN transaktion med transaction-lokal tenant-kontekst,
 * så PostgreSQL RLS-policies kan læse app.current_person_id / app.current_org_id.
 *
 * set_config(..., true) = LOCAL -> konteksten nulstilles automatisk og lækker
 * IKKE gennem en transaction-mode connection pooler (PgBouncer). Dette er den
 * konkrete løsning på Prisma + RLS-faldgruben fra arkitekturdokumentet.
 */
@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async withTenant<T>(ctx: TenantContext, work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx: Tx) => {
      await tx.$queryRawUnsafe(
        `SELECT set_config('app.current_person_id', $1, true),
                set_config('app.current_org_id', $2, true)`,
        ctx.personId ?? '',
        ctx.orgId ?? '',
      );
      return work(tx);
    });
  }
}
