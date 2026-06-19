import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common';
import { currentContext } from '../tenant/tenant-context';

/** Afviser requests uden en gyldig (verificeret) aktør i konteksten. */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    if (!currentContext().personId) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
