import { Injectable } from '@nestjs/common';
import { OwnershipRegistryAdapter } from './ownership-registry.interface';

/** Placeholder for tinglysnings-/Datafordeleren-opslag. */
@Injectable()
export class MockOwnershipRegistry implements OwnershipRegistryAdapter {
  async lookupOwner(bfeNumber: string): Promise<string[]> {
    return [`owner-of-${bfeNumber}`];
  }
}
