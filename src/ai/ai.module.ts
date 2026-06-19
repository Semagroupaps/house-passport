import { Module } from '@nestjs/common';
import { OCR_ADAPTER, CLASSIFIER, METADATA_EXTRACTOR, EMBEDDING_ADAPTER } from './ai.interface';
import { MockOcrAdapter, MockClassifier, MockMetadataExtractor, MockEmbeddingAdapter } from './mock-ai.adapters';
import { OpenAiClient } from './openai.client';
import { OpenAiOcrAdapter, OpenAiClassifier, OpenAiMetadataExtractor, OpenAiEmbeddingAdapter } from './openai-ai.adapters';

const real = OpenAiClient.isConfigured();

@Module({
  providers: [
    OpenAiClient,
    MockOcrAdapter, MockClassifier, MockMetadataExtractor, MockEmbeddingAdapter,
    OpenAiOcrAdapter, OpenAiClassifier, OpenAiMetadataExtractor, OpenAiEmbeddingAdapter,
    { provide: OCR_ADAPTER, useClass: real ? OpenAiOcrAdapter : MockOcrAdapter },
    { provide: CLASSIFIER, useClass: real ? OpenAiClassifier : MockClassifier },
    { provide: METADATA_EXTRACTOR, useClass: real ? OpenAiMetadataExtractor : MockMetadataExtractor },
    { provide: EMBEDDING_ADAPTER, useClass: real ? OpenAiEmbeddingAdapter : MockEmbeddingAdapter },
  ],
  exports: [OCR_ADAPTER, CLASSIFIER, METADATA_EXTRACTOR, EMBEDDING_ADAPTER, OpenAiClient],
})
export class AiModule {}
