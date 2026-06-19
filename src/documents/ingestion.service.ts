import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { STORAGE_ADAPTER, StorageAdapter } from '../storage/storage.interface';
import { EncryptionService } from '../storage/encryption.service';
import { QUEUE_ADAPTER, QueueAdapter } from '../queue/queue.interface';
import {
  OCR_ADAPTER, CLASSIFIER, METADATA_EXTRACTOR, EMBEDDING_ADAPTER,
  OcrAdapter, DocumentClassifier, MetadataExtractor, EmbeddingAdapter,
} from '../ai/ai.interface';
import { DOCUMENT_UPLOADED } from './documents.service';

interface UploadedEvent {
  documentId: string;
  propertyId: string;
  actingPersonId?: string;
  actingOrgId?: string;
}

/**
 * Async worker: OCR -> klassificering -> metadata -> embeddings -> status.
 * Kører inden for UPLOADERENS kontekst (de havde skriveadgang), så RLS
 * bevares også i baggrundsbehandlingen. Idempotent: springer over hvis
 * allerede behandlet.
 */
@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly tenant: TenantService,
    private readonly encryption: EncryptionService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    @Inject(QUEUE_ADAPTER) private readonly queue: QueueAdapter,
    @Inject(OCR_ADAPTER) private readonly ocr: OcrAdapter,
    @Inject(CLASSIFIER) private readonly classifier: DocumentClassifier,
    @Inject(METADATA_EXTRACTOR) private readonly metadata: MetadataExtractor,
    @Inject(EMBEDDING_ADAPTER) private readonly embeddings: EmbeddingAdapter,
  ) {}

  onModuleInit(): void {
    this.queue.subscribe(DOCUMENT_UPLOADED, (msg: UploadedEvent) => this.handle(msg));
  }

  private async handle(msg: UploadedEvent): Promise<void> {
    const ctx = { personId: msg.actingPersonId, orgId: msg.actingOrgId };
    await this.tenant.withTenant(ctx, async (tx) => {
      const doc = await tx.document.findUnique({ where: { id: msg.documentId } });
      if (!doc || doc.processingStatus === 'processed') return; // idempotent

      try {
        const blob = await this.storage.get(doc.s3Key);
        const plaintext = await this.encryption.decrypt(blob, doc.encryptionKeyRef);

        const text = await this.ocr.extractText(plaintext);
        const category = await this.classifier.classify(text);
        const meta = await this.metadata.extract(text);
        const vector = await this.embeddings.embed(text);

        // Ryd evt. tidligere chunks, så genbehandling (retry) ikke dublerer.
        await tx.$executeRawUnsafe(`DELETE FROM document_chunk WHERE document_id = $1`, doc.id);

        // Embedding skrives via raw SQL (pgvector); RLS gælder via property_id.
        await tx.$executeRawUnsafe(
          `INSERT INTO document_chunk (document_id, property_id, chunk_index, chunk_text, embedding)
           VALUES ($1, $2, 0, $3, $4::vector)`,
          doc.id,
          doc.propertyId,
          text.slice(0, 2000),
          `[${vector.join(',')}]`,
        );

        await tx.document.update({
          where: { id: doc.id },
          data: { processingStatus: 'processed', category, aiMetadata: meta as any },
        });
        this.logger.log(`Dokument ${doc.id} behandlet -> ${category}`);
      } catch (e) {
        this.logger.error(`Behandling af dokument ${doc.id} fejlede: ${String(e)}`);
        await tx.document.update({
          where: { id: doc.id },
          data: { processingStatus: 'failed', aiMetadata: { error: String(e) } as any },
        });
      }
    });
  }
}
