import { Injectable } from '@nestjs/common';
import { RegistryAdapter, RegistryData } from './registry.interface';

/**
 * Placeholder for den rigtige BBR/Datafordeleren-adapter (Sprint 1-opgave:
 * indgå dataaftale, håndtér latens/rate-limits). Returnerer deterministiske
 * stub-data, så onboarding-flowet kan bygges og testes nu.
 */
@Injectable()
export class MockBbrAdapter implements RegistryAdapter {
  async lookupByAddress(address: string): Promise<RegistryData> {
    const seed = Buffer.from(address).toString('hex').slice(0, 8);
    return {
      bfeNumber: `BFE-${seed}`,
      address,
      energyLabel: 'C',
      propertyType: 'parcelhus',
      buildYear: 1974,
      bbrSnapshot: { areaM2: 142, heating: 'fjernvarme', source: 'mock-bbr' },
    };
  }
}
