import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MaintenanceService, CreateTaskDto } from './maintenance.service';
import { AuthGuard } from '../common/auth.guard';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1/properties/:propertyId/tasks')
@UseGuards(AuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  list(@Param('propertyId') propertyId: string) {
    return this.maintenance.list(currentContext(), propertyId);
  }

  @Post()
  create(@Param('propertyId') propertyId: string, @Body() body: CreateTaskDto) {
    return this.maintenance.create(currentContext(), propertyId, body);
  }

  @Post(':taskId/complete')
  complete(@Param('propertyId') propertyId: string, @Param('taskId') taskId: string) {
    return this.maintenance.complete(currentContext(), propertyId, taskId);
  }
}
