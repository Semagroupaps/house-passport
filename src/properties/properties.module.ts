import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { TenantModule } from '../tenant/tenant.module';
import { RegistryModule } from '../registry/registry.module';

@Module({
  imports: [TenantModule, RegistryModule],
  controllers: [PropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
