import { Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { TenantContext } from '../tenant/tenant-context';

export interface CreateWarrantyDto {
  title: string;
  provider?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class WarrantiesService {
  constructor(private readonly tenant: TenantService) {}

  list(ctx: TenantContext, propertyId: string) {
    return this.tenant.withTenant(ctx, (tx) =>
      (tx as any).warranty.findMany({ where: { propertyId }, orderBy: { endDate: 'asc' } }),
    );
  }

  create(ctx: TenantContext, propertyId: string, dto: CreateWarrantyDto) {
    return this.tenant.withTenant(ctx, (tx) =>
      (tx as any).warranty.create({
        data: {
          propertyId,
          title: dto.title,
          provider: dto.provider ?? null,
          category: dto.category ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        },
      }),
    );
  }
}
