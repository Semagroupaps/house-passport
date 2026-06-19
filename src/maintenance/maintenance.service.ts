import { Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { TenantContext } from '../tenant/tenant-context';

export interface CreateTaskDto {
  title: string;
  category?: string;
  priority?: string;
  dueDate?: string;
  intervalMonths?: number;
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly tenant: TenantService) {}

  list(ctx: TenantContext, propertyId: string) {
    return this.tenant.withTenant(ctx, (tx) =>
      (tx as any).maintenanceTask.findMany({
        where: { propertyId },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      }),
    );
  }

  create(ctx: TenantContext, propertyId: string, dto: CreateTaskDto) {
    return this.tenant.withTenant(ctx, (tx) =>
      (tx as any).maintenanceTask.create({
        data: {
          propertyId,
          title: dto.title,
          category: dto.category ?? null,
          priority: dto.priority ?? 'normal',
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          intervalMonths: dto.intervalMonths ?? null,
        },
      }),
    );
  }

  /** Markér fuldført. RLS sikrer, at kun ejeren kan opdatere. Tilbagevendende
   *  opgaver genskaber automatisk næste forekomst. */
  complete(ctx: TenantContext, _propertyId: string, taskId: string) {
    return this.tenant.withTenant(ctx, async (tx) => {
      const task = await (tx as any).maintenanceTask.update({
        where: { id: taskId },
        data: { status: 'done', completedAt: new Date() },
      });
      if (task.intervalMonths && task.intervalMonths > 0) {
        const next = new Date();
        next.setMonth(next.getMonth() + task.intervalMonths);
        await (tx as any).maintenanceTask.create({
          data: {
            propertyId: task.propertyId,
            title: task.title,
            category: task.category,
            priority: task.priority,
            dueDate: next,
            intervalMonths: task.intervalMonths,
          },
        });
      }
      return task;
    });
  }
}
