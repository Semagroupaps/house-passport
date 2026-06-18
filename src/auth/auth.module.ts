import { Module } from '@nestjs/common';
import { AUTH_PROVIDER } from './auth-provider.interface';
import { MockAuthProvider } from './mock-auth.provider';

@Module({
  providers: [{ provide: AUTH_PROVIDER, useClass: MockAuthProvider }],
  exports: [AUTH_PROVIDER],
})
export class AuthModule {}
