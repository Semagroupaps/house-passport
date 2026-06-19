import { Controller, Get, Query, Res } from '@nestjs/common';
import { VerificationService } from './verification.service';

/**
 * Offentligt callback fra MitID-brokeren. Browseren ankommer fra brokeren (uden
 * vores JWT) — sessionen identificeres via 'state', som vi bandt til brugeren ved
 * initiate. Sender brugeren tilbage til appen med resultatet.
 */
@Controller('v1/auth/mitid')
export class MitIdCallbackController {
  constructor(private readonly verification: VerificationService) {}

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: any) {
    try {
      await this.verification.handleCallback(code, state);
      res.redirect('/app/?verified=1');
    } catch (e) {
      res.redirect('/app/?verified=0');
    }
  }
}
