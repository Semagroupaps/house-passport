/** Normaliserede boligdata fra et nationalt register. */
export interface RegistryData {
  bfeNumber: string;
  address: string;
  energyLabel?: string;
  propertyType?: string;
  buildYear?: number;
  bbrSnapshot: Record<string, unknown>;
}

/**
 * Adapter over national boligdatainfrastruktur. DK = BBR/Datafordeleren.
 * Internationaliseringsmønstret fra Trin 4.6: nyt land = ny adapter, ingen
 * ændring i kernen.
 */
export interface RegistryAdapter {
  lookupByAddress(address: string): Promise<RegistryData>;
}

export const REGISTRY_ADAPTER = Symbol('REGISTRY_ADAPTER');
