/** Stærkt verificeret identitet fra en certificeret MitID-broker. */
export interface VerifiedIdentity {
  /** Pseudonym afledt af den signerede MitID-assertion — ALDRIG fra klient-input. */
  authoritativeId: string;
  name: string;
  assuranceLevel: 'low' | 'substantial' | 'high';
}

/**
 * Abstraktion over den certificerede MitID-broker. Vi fødererer mod brokeren
 * og bygger aldrig egen IdP. Skiftes ud uden kerneændringer (jf. AuthProvider).
 */
export interface MitIdBroker {
  initiate(): Promise<{ sessionId: string; redirectUrl: string }>;
  complete(brokerCode: string): Promise<VerifiedIdentity>;
}
export const MITID_BROKER = Symbol('MITID_BROKER');
