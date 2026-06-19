import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenant: TenantService,
  ) {}

  @Post('register')
  @HttpCode(201)
  register(@Body() body: { email: string; password: string; displayName?: string }) {
    return this.auth.register(body.email, body.password, body.displayName);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me() {
    const ctx = currentContext();
    return this.tenant.withTenant(ctx, async (tx) => {
      const p: any = await tx.person.findUnique({ where: { id: ctx.personId as string } });
      return p ? { id: p.id, email: p.email, displayName: p.displayName, isMitidVerified: p.isMitidVerified } : null;
    });
  }
}
