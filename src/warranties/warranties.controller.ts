import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WarrantiesService, CreateWarrantyDto } from './warranties.service';
import { AuthGuard } from '../common/auth.guard';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1/properties/:propertyId/warranties')
@UseGuards(AuthGuard)
export class WarrantiesController {
  constructor(private readonly warranties: WarrantiesService) {}

  @Get()
  list(@Param('propertyId') propertyId: string) {
    return this.warranties.list(currentContext(), propertyId);
  }

  @Post()
  create(@Param('propertyId') propertyId: string, @Body() body: CreateWarrantyDto) {
    return this.warranties.create(currentContext(), propertyId, body);
  }
}
