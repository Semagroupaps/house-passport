import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { WarrantiesController } from './warranties.controller';
import { WarrantiesService } from './warranties.service';

@Module({
  imports: [TenantModule],
  controllers: [WarrantiesController],
  providers: [WarrantiesService],
})
export class WarrantiesModule {}
