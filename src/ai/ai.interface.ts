/** OCR, klassificering, metadata og embeddings — alle bag interfaces (OpenAI m.fl.). */
export interface OcrAdapter {
  extractText(bytes: Buffer): Promise<string>;
}
export interface DocumentClassifier {
  classify(text: string): Promise<string>;
}
export interface MetadataExtractor {
  extract(text: string): Promise<Record<string, unknown>>;
}
export interface EmbeddingAdapter {
  embed(text: string): Promise<number[]>; // 1536 dim (text-embedding-3-small)
}
export const OCR_ADAPTER = Symbol('OCR_ADAPTER');
export const CLASSIFIER = Symbol('CLASSIFIER');
export const METADATA_EXTRACTOR = Symbol('METADATA_EXTRACTOR');
export const EMBEDDING_ADAPTER = Symbol('EMBEDDING_ADAPTER');
