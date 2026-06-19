import { Injectable, Logger } from '@nestjs/common';
import { OcrAdapter, DocumentClassifier, MetadataExtractor, EmbeddingAdapter } from './ai.interface';
import { OpenAiClient } from './openai.client';
import { extractPdfText } from './pdf-text';

const CATEGORIES = [
  'El', 'VVS', 'Tag', 'Vinduer og døre', 'Varme', 'Energimærke', 'Garanti',
  'Forsikring', 'Tegninger', 'Skøde og tinglysning', 'Vurdering', 'Kvittering', 'Andet',
];

function sniffImage(b: Buffer): string | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

@Injectable()
export class OpenAiOcrAdapter implements OcrAdapter {
  private readonly logger = new Logger(OpenAiOcrAdapter.name);
  constructor(private readonly client: OpenAiClient) {}

  async extractText(bytes: Buffer): Promise<string> {
    if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
      const pdf = extractPdfText(bytes);
      if (pdf && pdf.length > 20) return pdf.slice(0, 20000);
      return `[PDF uden tekstlag (${bytes.length} bytes). Scannet PDF kræver en OCR-tjeneste.]`;
    }
    const text = bytes.toString('utf8');
    const nonPrintable = (text.match(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]/g) || []).length;
    if (text.trim().length > 0 && nonPrintable < text.length * 0.1) return text.slice(0, 20000);

    const mime = sniffImage(bytes);
    if (mime && this.client.isConfigured()) {
      try {
        const t = await this.client.visionOcr(`data:${mime};base64,${bytes.toString('base64')}`);
        if (t.trim()) return t.slice(0, 20000);
      } catch (e) { this.logger.warn('Vision-OCR fejlede: ' + String(e)); }
    }
    return `[Ikke-tekstligt dokument (${bytes.length} bytes). OCR for denne filtype kræver en dedikeret tjeneste (fx Textract/PDF-parser).]`;
  }
}

@Injectable()
export class OpenAiClassifier implements DocumentClassifier {
  constructor(private readonly client: OpenAiClient) {}
  async classify(text: string): Promise<string> {
    if (!this.client.isConfigured() || !text.trim()) return 'Ukategoriseret';
    try {
      const out = await this.client.chat(
        'Du klassificerer danske boligdokumenter. Returnér JSON {"kategori":"..."}, hvor kategori er præcis én af: ' + CATEGORIES.join(', ') + '.',
        text.slice(0, 4000), true,
      );
      const cat = JSON.parse(out).kategori;
      return CATEGORIES.includes(cat) ? cat : 'Andet';
    } catch {
      return 'Ukategoriseret';
    }
  }
}

@Injectable()
export class OpenAiMetadataExtractor implements MetadataExtractor {
  constructor(private readonly client: OpenAiClient) {}
  async extract(text: string): Promise<Record<string, unknown>> {
    if (!this.client.isConfigured() || !text.trim()) return { source: 'none' };
    try {
      const out = await this.client.chat(
        'Udtræk strukturerede felter fra et dansk boligdokument. Returnér KUN JSON med felterne: ' +
        'dokumentdato (ISO-dato eller null), firma (string eller null), beloeb (tal eller null), ' +
        'garanti (objekt {start,slut} eller null), resume (kort dansk sætning), noegleord (array af strings).',
        text.slice(0, 6000), true,
      );
      return { ...JSON.parse(out), source: 'openai' };
    } catch (e) {
      return { source: 'openai', aiError: String(e) };
    }
  }
}

@Injectable()
export class OpenAiEmbeddingAdapter implements EmbeddingAdapter {
  private readonly logger = new Logger(OpenAiEmbeddingAdapter.name);
  constructor(private readonly client: OpenAiClient) {}
  async embed(text: string): Promise<number[]> {
    if (this.client.isConfigured() && text.trim()) {
      try {
        const v = await this.client.embed(text);
        if (Array.isArray(v) && v.length === 1536) return v;
        if (Array.isArray(v) && v.length) {
          this.logger.warn(`Embedding-dim ${v.length} != 1536; bruger fallback for at matche skemaet`);
        }
      } catch (e) { this.logger.warn('Embeddings fejlede: ' + String(e)); }
    }
    // Deterministisk fallback (1536) så pipelinen aldrig blokerer.
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) % 1000;
    return Array.from({ length: 1536 }, (_, i) => ((seed + i) % 100) / 100);
  }
}
