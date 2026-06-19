import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { AuthGuard } from '../common/auth.guard';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1')
@UseGuards(AuthGuard)
export class TransferController {
  constructor(private readonly transfer: TransferService) {}

  @Post('properties/:propertyId/transfer')
  initiate(@Param('propertyId') propertyId: string, @Body() body: { buyerEmail: string; saleDate?: string }) {
    return this.transfer.initiate(currentContext(), propertyId, body.buyerEmail, body.saleDate);
  }

  @Get('properties/:propertyId/transfers')
  outgoingForProperty(@Param('propertyId') propertyId: string) {
    return this.transfer.outgoing(currentContext(), propertyId);
  }

  @Get('transfers/incoming')
  incoming() {
    return this.transfer.incoming(currentContext());
  }

  @Post('transfers/:id/accept')
  accept(@Param('id') id: string) {
    return this.transfer.accept(currentContext(), id);
  }

  @Post('transfers/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.transfer.cancel(currentContext(), id);
  }
}
