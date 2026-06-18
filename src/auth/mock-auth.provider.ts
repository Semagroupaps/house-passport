import { Injectable } from '@nestjs/common';
import { AuthProvider, AuthenticatedActor } from './auth-provider.interface';

/**
 * Placeholder-udbyder KUN til lokal udvikling/test.
 * Token-format: "personId" eller "personId:orgId".
 * Erstattes af ClerkAuthProvider / Auth0AuthProvider uden ændringer i kernen.
 */
@Injectable()
export class MockAuthProvider implements AuthProvider {
  async verify(token: string): Promise<AuthenticatedActor> {
    const [personId, orgId] = token.split(':');
    if (!personId) {
      throw new Error('Ugyldigt token');
    }
    return { personId, orgId: orgId || undefined, isMitidVerified: false };
  }
}
