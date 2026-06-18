import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from './tenant.service';

@Module({
  providers: [PrismaService, TenantService],
  exports: [PrismaService, TenantService],
})
export class TenantModule {}
