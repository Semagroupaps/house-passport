/**
 * Autoritativt ejerregister (tinglysning/Datafordeleren). Adskilt fra BBR-data:
 * dette svarer på "hvem ejer denne ejendom ifølge det officielle register".
 */
export interface OwnershipRegistryAdapter {
  lookupOwner(bfeNumber: string): Promise<string[]>; // autoritative ejer-id'er
}
export const OWNERSHIP_REGISTRY = Symbol('OWNERSHIP_REGISTRY');
