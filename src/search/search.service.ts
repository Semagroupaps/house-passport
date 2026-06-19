import { Inject, Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { TenantContext } from '../tenant/tenant-context';
import { EMBEDDING_ADAPTER, EmbeddingAdapter } from '../ai/ai.interface';
import { OpenAiClient } from '../ai/openai.client';

interface Hit { documentId: string; chunkText: string; filename: string; category: string | null; score: number }

/**
 * Semantisk søgning og "spørg dine dokumenter" (RAG). Query-embedding laves med
 * SAMME model som indekseringen (1536d). pgvector cosine-afstand (<=>) finder de
 * nærmeste chunks. RLS på document_chunk sikrer, at kun boligens egne (og delte)
 * dokumenter returneres — søgningen kan aldrig lække på tværs af boliger.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly tenant: TenantService,
    @Inject(EMBEDDING_ADAPTER) private readonly embeddings: EmbeddingAdapter,
    private readonly openai: OpenAiClient,
  ) {}

  async search(ctx: TenantContext, propertyId: string, query: string, k = 6): Promise<Hit[]> {
    if (!query.trim()) return [];
    const vec = await this.embeddings.embed(query);
    const literal = `[${vec.join(',')}]`;
    return this.tenant.withTenant(ctx, async (tx) => {
      const rows: any[] = await tx.$queryRawUnsafe(
        `SELECT dc.document_id AS "documentId", dc.chunk_text AS "chunkText",
                d.filename AS "filename", d.category AS "category",
                1 - (dc.embedding <=> $1::vector) AS "score"
         FROM document_chunk dc
         JOIN document d ON d.id = dc.document_id
         WHERE dc.property_id = $2 AND d.processing_status = 'processed'
         ORDER BY dc.embedding <=> $1::vector
         LIMIT $3`,
        literal, propertyId, k,
      );
      return rows.map((r) => ({ ...r, score: Number(r.score) }));
    });
  }

  async ask(ctx: TenantContext, propertyId: string, question: string, k = 6) {
    const hits = await this.search(ctx, propertyId, question, k);
    const sources = hits.map((h) => ({ documentId: h.documentId, filename: h.filename, category: h.category, score: h.score }));
    if (!hits.length) {
      return { answer: 'Jeg fandt ingen behandlede dokumenter for din bolig at svare ud fra endnu.', sources: [] };
    }
    if (!this.openai.isConfigured()) {
      return { answer: 'Her er de mest relevante uddrag fra dine dokumenter:', sources, excerpts: hits.map((h) => h.chunkText) };
    }
    const context = hits.map((h, i) => `[${i + 1}] (${h.filename}) ${h.chunkText}`).join('\n\n');
    const answer = await this.openai.chat(
      'Du er en hjælpsom assistent for en dansk boligejer. Svar KUN ud fra de givne dokumentuddrag. ' +
      'Hvis svaret ikke fremgår, så sig det ærligt. Henvis til kilder med [nummer]. Svar på dansk.',
      `Dokumentuddrag:\n${context}\n\nSpørgsmål: ${question}`,
    ).catch(() => 'Kunne ikke generere et svar lige nu.');
    return { answer, sources };
  }
}
