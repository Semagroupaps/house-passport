import { Inject, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { QUEUE_ADAPTER, QueueAdapter } from '../queue/queue.interface';
import { DOCUMENT_UPLOADED } from '../documents/documents.service';

export interface AdminActor { id: string; email: string | null; name: string | null }

/**
 * Drift/admin. Bruger admin-forbindelsen (uden for RLS), fordi dette er et
 * system-view. Adgang styres af AdminGuard (isAdmin-flag eller ADMIN_EMAILS-allowlist).
 */
@Injectable()
export class AdminService implements OnModuleDestroy {
  private readonly db = new PrismaClient({ datasources: { db: { url: process.env.ADMIN_DATABASE_URL } } });

  constructor(@Inject(QUEUE_ADAPTER) private readonly queue: QueueAdapter) {}

  /** Returnerer admin-aktøren hvis personen er administrator, ellers null. */
  async resolveAdmin(personId?: string): Promise<AdminActor | null> {
    if (!personId) return null;
    const p: any = await (this.db as any).person.findUnique({ where: { id: personId } });
    if (!p) return null;
    const allow = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    const isAdmin = p.isAdmin === true || (p.email && allow.includes(String(p.email).toLowerCase()));
    return isAdmin ? { id: p.id, email: p.email ?? null, name: p.displayName ?? null } : null;
  }

  async overview() {
    const [organizations, persons, properties, ownerships, grants, documents] = await Promise.all([
      this.db.organization.count(),
      this.db.person.count(),
      this.db.property.count(),
      this.db.ownershipPeriod.count(),
      this.db.accessGrant.count(),
      this.db.document.count(),
    ]);
    return { organizations, persons, properties, ownerships, grants, documents };
  }

  async pipeline() {
    const queue = await this.queue.stats(DOCUMENT_UPLOADED);
    const grouped: any[] = await (this.db as any).document.groupBy({ by: ['processingStatus'], _count: { _all: true } });
    const documents: Record<string, number> = {};
    for (const g of grouped) documents[g.processingStatus] = g._count._all;
    return { queue, documents, generatedAt: new Date().toISOString() };
  }

  async deadLetter() {
    return this.queue.listDeadLetter(DOCUMENT_UPLOADED, 50);
  }
  async requeueDeadLetter(id: string) {
    const ok = await this.queue.requeueDeadLetter(DOCUMENT_UPLOADED, id);
    if (!ok) throw new NotFoundException('Dead-letter-besked ikke fundet');
    return { id, requeued: true };
  }
  async discardDeadLetter(id: string) {
    await this.queue.discardDeadLetter(DOCUMENT_UPLOADED, id);
    return { id, discarded: true };
  }

  async documents(status = 'failed') {
    const rows: any[] = await (this.db as any).document.findMany({
      where: { processingStatus: status },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, filename: true, propertyId: true, processingStatus: true, category: true, createdAt: true },
    });
    return rows;
  }

  /** Admin-retry: kør behandlingen igen i den NUVÆRENDE ejers kontekst (RLS-gyldig). */
  async retryDocument(documentId: string) {
    const doc: any = await (this.db as any).document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException();
    const owner: any = await (this.db as any).ownershipPeriod.findFirst({
      where: { propertyId: doc.propertyId, validTo: null },
    });
    await (this.db as any).document.update({
      where: { id: documentId },
      data: { processingStatus: 'pending', aiMetadata: undefined },
    });
    await this.queue.publish(DOCUMENT_UPLOADED, {
      documentId: doc.id, propertyId: doc.propertyId, actingPersonId: owner?.personId,
    });
    return { documentId, status: 'pending' };
  }

  async setAdmin(personId: string, isAdmin: boolean) {
    await (this.db as any).person.update({ where: { id: personId }, data: { isAdmin } });
    return { personId, isAdmin };
  }

  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}
