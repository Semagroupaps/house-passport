import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MitIdBroker, VerifiedIdentity } from './mitid-broker.interface';

/** Placeholder for den rigtige broker-integration. */
@Injectable()
export class MockMitIdBroker implements MitIdBroker {
  async initiate(): Promise<{ sessionId: string; redirectUrl: string }> {
    const sessionId = randomUUID();
    return { sessionId, redirectUrl: `https://broker.local/mitid/${sessionId}` };
  }
  async complete(brokerCode: string): Promise<VerifiedIdentity> {
    // I produktion afledes authoritativeId af den signerede MitID-assertion via
    // brokeren — her er brokerCode en testsøm, der står for det verificerede id.
    if (!brokerCode) throw new Error('Manglende broker-kode');
    return { authoritativeId: brokerCode, name: 'Verificeret Bruger', assuranceLevel: 'high' };
  }
}
