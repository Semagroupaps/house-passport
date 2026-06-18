import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  @Post(':id/transfer')
  transfer(@Param('id') id: string, @Body() body: { saleDate?: string }) {
    const date = body.saleDate ? new Date(body.saleDate) : new Date();
    return this.properties.transfer(currentContext(), id, date);
  }

  @Get(':id/documents')
  documents(@Param('id') id: string) {
    return this.properties.listDocuments(currentContext(), id);
  }
}
