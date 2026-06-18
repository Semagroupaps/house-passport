import { Module } from '@nestjs/common';
import {
  OCR_ADAPTER, CLASSIFIER, METADATA_EXTRACTOR, EMBEDDING_ADAPTER,
} from './ai.interface';
import {
  MockOcrAdapter, MockClassifier, MockMetadataExtractor, MockEmbeddingAdapter,
} from './mock-ai.adapters';

@Module({
  providers: [
    { provide: OCR_ADAPTER, useClass: MockOcrAdapter },
    { provide: CLASSIFIER, useClass: MockClassifier },
    { provide: METADATA_EXTRACTOR, useClass: MockMetadataExtractor },
    { provide: EMBEDDING_ADAPTER, useClass: MockEmbeddingAdapter },
  ],
  exports: [OCR_ADAPTER, CLASSIFIER, METADATA_EXTRACTOR, EMBEDDING_ADAPTER],
})
export class AiModule {}
