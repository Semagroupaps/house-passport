import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { AuthGuard } from '../common/auth.guard';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1/properties')
@UseGuards(AuthGuard)
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list() {
    return this.properties.listVisible(currentContext());
  }

  @Post()
  create(@Body() body: { address: string }) {
    return this.properties.createFromAddress(currentContext(), body.address);
  }

  @Get(':id/documents')
  documents(@Param('id') id: string) {
    return this.properties.listDocuments(currentContext(), id);
  }

  @Get(':id/overview')
  overview(@Param('id') id: string) {
    return this.properties.overview(currentContext(), id);
  }

  @Post(':id/refresh-bbr')
  refreshBbr(@Param('id') id: string) {
    return this.properties.refreshBbr(currentContext(), id);
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.properties.deleteProperty(currentContext(), id);
  }
}
