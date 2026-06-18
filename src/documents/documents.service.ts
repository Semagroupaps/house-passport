import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantService } from '../tenant/tenant.service';
import { TenantContext } from '../tenant/tenant-context';
import { STORAGE_ADAPTER, StorageAdapter } from '../storage/storage.interface';
import { EncryptionService } from '../storage/encryption.service';
import { QUEUE_ADAPTER, QueueAdapter } from '../queue/queue.interface';

export const DOCUMENT_UPLOADED = 'document.uploaded';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly tenant: TenantService,
    private readonly encryption: EncryptionService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    @Inject(QUEUE_ADAPTER) private readonly queue: QueueAdapter,
  ) {}

  /**
   * Upload: krypter (envelope) -> gem ciphertext -> opret dokumentrække (status
   * pending) -> publicér DocumentUploaded. WITH CHECK-policyen sikrer, at kun
   * ejer/skrive-grant kan oprette. Idempotency-Key dedupliker retries.
   */
  async upload(
    ctx: TenantContext,
    propertyId: string,
    filename: string,
    bytes: Buffer,
    idempotencyKey?: string,
  ) {
    return this.tenant.withTenant(ctx, async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.document.findUnique({ where: { idempotencyKey } });
        if (existing) {
          return { documentId: existing.id, status: existing.processingStatus, idempotent: true };
        }
      }
      const { ciphertext, keyRef } = await this.encryption.encrypt(bytes);
      const s3Key = `prop/${propertyId}/${randomUUID()}`;
      await this.storage.put(s3Key, ciphertext);

      const doc = await tx.document.create({
        data: {
          propertyId,
          filename,
          source: 'manual',
          s3Key,
          encryptionKeyRef: keyRef,
          processingStatus: 'pending',
          idempotencyKey: idempotencyKey ?? null,
        },
      });

      await this.queue.publish(DOCUMENT_UPLOADED, {
        documentId: doc.id,
        propertyId,
        actingPersonId: ctx.personId,
        actingOrgId: ctx.orgId,
      });

      return { documentId: doc.id, status: 'pending', idempotent: false };
    });
  }

  async getStatus(ctx: TenantContext, documentId: string) {
    return this.tenant.withTenant(ctx, async (tx) => {
      const doc = await tx.document.findUnique({ where: { id: documentId } });
      if (!doc) throw new NotFoundException();
      return { documentId: doc.id, status: doc.processingStatus, category: doc.category };
    });
  }

  /**
   * GDPR-sletning via crypto-shredding. Først en autoriserende update (RLS
   * tillader kun skrivere) -> derefter destrueres nøglen -> indholdet er
   * permanent ulæseligt, også i backups. Auditfakta bevares andetsteds.
   */
  async shred(ctx: TenantContext, documentId: string) {
    return this.tenant.withTenant(ctx, async (tx) => {
      const doc = await tx.document.findUnique({ where: { id: documentId } });
      if (!doc) throw new NotFoundException();

      // Autoritetstjek: denne update fejler under RLS, hvis aktøren ikke har skriveadgang.
      await tx.document.update({
        where: { id: documentId },
        data: { processingStatus: 'deleting' },
      });

      await this.encryption.shred(doc.encryptionKeyRef);
      await this.storage.delete(doc.s3Key);

      await tx.document.update({
        where: { id: documentId },
        data: { processingStatus: 'deleted', deletedAt: new Date(), s3Key: '', encryptionKeyRef: '' },
      });
      return { documentId, status: 'deleted' };
    });
  }
}
