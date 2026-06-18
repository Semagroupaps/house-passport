import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { AuthGuard } from '../common/auth.guard';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1/properties/:propertyId/verification')
@UseGuards(AuthGuard)
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post('initiate')
  initiate() {
    return this.verification.initiate();
  }

  @Post('complete')
  complete(
    @Param('propertyId') propertyId: string,
    @Body() body: { brokerCode: string },
  ) {
    return this.verification.complete(currentContext(), propertyId, body.brokerCode);
  }
}
