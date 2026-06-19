/** Resultatet af at verificere et token. Udledes serverside. */
export interface AuthenticatedActor {
  personId: string;
  orgId?: string;
  isMitidVerified: boolean;
}

/**
 * Abstraktion over identitetsudbyderen, så Clerk- vs. Auth0-beslutningen
 * (Trin 4.8 / Trin 18) ikke blokerer fundamentet. MitID-broker fødereres
 * bag en konkret implementering — vi bygger aldrig egen IdP.
 */
export interface AuthProvider {
  verify(token: string): Promise<AuthenticatedActor>;
}

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
