import { Injectable } from '@nestjs/common';
import { AuthProvider, AuthenticatedActor } from './auth-provider.interface';
import { verifyToken } from './jwt';

/** Verificerer rigtige JWT'er udstedt af AuthService. */
@Injectable()
export class JwtAuthProvider implements AuthProvider {
  async verify(token: string): Promise<AuthenticatedActor> {
    const { sub } = verifyToken(token);
    return { personId: sub, isMitidVerified: false };
  }
}
