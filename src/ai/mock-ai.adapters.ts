import { Injectable } from '@nestjs/common';
import {
  OcrAdapter, DocumentClassifier, MetadataExtractor, EmbeddingAdapter,
} from './ai.interface';
import { extractPdfText } from './pdf-text';

@Injectable()
export class MockOcrAdapter implements OcrAdapter {
  async extractText(bytes: Buffer): Promise<string> {
    if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
      const pdf = extractPdfText(bytes);
      if (pdf && pdf.length > 20) return pdf.slice(0, 20000);
    }
    // Placeholder: rigtig OCR (Textract/Tesseract) erstatter dette.
    const head = bytes.subarray(0, 200).toString('utf8').replace(/[^\x20-\x7eæøåÆØÅ\n]/g, ' ');
    return head.trim() || `[OCR-tekst for ${bytes.length} bytes]`;
  }
}

@Injectable()
export class MockClassifier implements DocumentClassifier {
  private readonly rules: [RegExp, string][] = [
    [/tag|tagrende|tagsten/i, 'Tag'],
    [/el|installation|stikkontakt/i, 'El'],
    [/vvs|rør|vand|varme/i, 'VVS'],
    [/garanti|reklamation/i, 'Garanti'],
    [/forsikring|police/i, 'Forsikring'],
  ];
  async classify(text: string): Promise<string> {
    for (const [re, cat] of this.rules) if (re.test(text)) return cat;
    return 'Ukategoriseret';
  }
}

@Injectable()
export class MockMetadataExtractor implements MetadataExtractor {
  async extract(text: string): Promise<Record<string, unknown>> {
    const year = text.match(/\b(19|20)\d{2}\b/)?.[0];
    return { extractedYear: year ?? null, length: text.length, source: 'mock' };
  }
}

@Injectable()
export class MockEmbeddingAdapter implements EmbeddingAdapter {
  async embed(text: string): Promise<number[]> {
    // Deterministisk pseudo-embedding (1536 dim) til lokal test.
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) % 1000;
    return Array.from({ length: 1536 }, (_, i) => ((seed + i) % 100) / 100);
  }
}
