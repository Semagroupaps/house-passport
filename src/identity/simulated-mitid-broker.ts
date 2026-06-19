import { Injectable } from '@nestjs/common';
import { MitIdBroker, VerifiedIdentity } from './mitid-broker.interface';

/**
 * Dev-broker: bruges når ingen MitID-broker er konfigureret. Sender brugeren
 * direkte til vores callback med en sim-kode, så hele flowet kan demonstreres
 * uden en rigtig broker. Springer ejer-matchet over (markeret i VerificationService).
 */
@Injectable()
export class SimulatedMitIdBroker implements MitIdBroker {
  isConfigured(): boolean {
    return false;
  }
  async buildAuthorizeUrl(p: { state: string }): Promise<string> {
    return `/v1/auth/mitid/callback?code=sim&state=${encodeURIComponent(p.state)}`;
  }
  async exchangeCode(): Promise<VerifiedIdentity> {
    return { authoritativeId: 'sim:verified', name: 'Simuleret MitID-bruger', assuranceLevel: 'high' };
  }
}
