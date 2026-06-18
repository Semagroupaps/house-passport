/** Ren funktion: matcher den MitID-verificerede identitet mod registrets ejere. */
export function matchesRegisteredOwner(identityId: string, registeredOwners: string[]): boolean {
  return registeredOwners.includes(identityId);
}
