import { Controller, HttpCode, Post } from '@nestjs/common';
import { DemoService } from './demo.service';

@Controller('v1/dev')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  // Opretter en demo-bruger + seedet bolig. Returnerer et mock-token.
  @Post('session')
  @HttpCode(201)
  session() {
    return this.demo.createSession();
  }
}
