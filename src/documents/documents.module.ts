import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { IngestionService } from './ingestion.service';
import { TenantModule } from '../tenant/tenant.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TenantModule, StorageModule, QueueModule, AiModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, IngestionService],
})
export class DocumentsModule {}
