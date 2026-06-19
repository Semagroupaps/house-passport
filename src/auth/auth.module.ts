import { Module } from '@nestjs/common';
import { AUTH_PROVIDER } from './auth-provider.interface';
import { JwtAuthProvider } from './jwt-auth.provider';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_PROVIDER, useClass: JwtAuthProvider },
  ],
  exports: [AUTH_PROVIDER],
})
export class AuthModule {}
