/** Stærkt verificeret identitet fra en certificeret MitID-broker. */
export interface VerifiedIdentity {
  /** Pseudonym/CPR afledt af den signerede MitID-assertion — ALDRIG fra klient-input. */
  authoritativeId: string;
  name: string;
  assuranceLevel: 'low' | 'substantial' | 'high';
}

/**
 * Abstraktion over den certificerede MitID-broker (OpenID Connect).
 * Vi fødererer mod brokeren og bygger aldrig egen IdP. Skiftes ud uden
 * kerneændringer — OIDC i produktion, simuleret i dev.
 */
export interface MitIdBroker {
  isConfigured(): boolean;
  buildAuthorizeUrl(p: { state: string; nonce: string; codeChallenge: string }): Promise<string>;
  exchangeCode(p: { code: string; codeVerifier: string; nonce: string }): Promise<VerifiedIdentity>;
}
export const MITID_BROKER = Symbol('MITID_BROKER');
