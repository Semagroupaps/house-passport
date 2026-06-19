import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { AuthGuard } from '../common/auth.guard';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1/properties/:propertyId/verification')
@UseGuards(AuthGuard)
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  /** Starter MitID-ejerverificering. Returnerer { redirectUrl } til browseren. */
  @Post('initiate')
  initiate(@Param('propertyId') propertyId: string) {
    return this.verification.initiate(currentContext(), propertyId);
  }
}
