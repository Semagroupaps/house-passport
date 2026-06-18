import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule], // for PrismaService
  controllers: [HealthController],
})
export class HealthModule {}
