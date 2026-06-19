import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SharingService } from './sharing.service';
import { AuthGuard } from '../common/auth.guard';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1/properties/:propertyId/shares')
@UseGuards(AuthGuard)
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  @Post()
  create(@Param('propertyId') propertyId: string, @Body() body: { email: string; role?: string }) {
    return this.sharing.share(currentContext(), propertyId, body.email, body.role === 'write' ? 'write' : 'read');
  }

  @Get()
  list(@Param('propertyId') propertyId: string) {
    return this.sharing.list(currentContext(), propertyId);
  }

  @Delete(':grantId')
  revoke(@Param('propertyId') propertyId: string, @Param('grantId') grantId: string) {
    return this.sharing.revoke(currentContext(), propertyId, grantId);
  }
}
