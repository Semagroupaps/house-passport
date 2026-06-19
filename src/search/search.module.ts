import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TenantModule } from '../tenant/tenant.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TenantModule, AiModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
