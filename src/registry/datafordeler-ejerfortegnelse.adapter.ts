import { Injectable, Logger } from '@nestjs/common';
import { OwnershipRegistryAdapter } from './ownership-registry.interface';
import { DatafordelerClient } from './datafordeler.client';

/**
 * Ejerfortegnelsen (EJF) på Datafordeleren — det autoritative register over de
 * FAKTISKE ejere, der opdateres af Det Digitale Tinglysningssystem. Returnerer
 * ejernes CPR/CVR for et BFE-nummer, som MitID-identiteten matches imod.
 *
 * Den fortrolige variant (med CPR) kræver en tjenestebruger godkendt af
 * Geodatastyrelsen. Uden credentials returneres en dev-fallback.
 */
@Injectable()
export class DatafordelerEjerfortegnelseAdapter implements OwnershipRegistryAdapter {
  private readonly logger = new Logger(DatafordelerEjerfortegnelseAdapter.name);

  constructor(private readonly df: DatafordelerClient) {}

  async lookupOwner(bfeNumber: string): Promise<string[]> {
    if (!this.df.isConfigured()) return [`owner-of-${bfeNumber}`]; // dev-fallback
    try {
      const data: any = await this.df.getJson('/EJF/Ejerfortegnelsen_fortrolig/1/rest/ejerskab', { BFEnr: bfeNumber });
      const features = data?.features || (Array.isArray(data) ? data : []);
      const owners: string[] = [];
      for (const f of features) {
        const p = f?.properties || f;
        const cpr = p?.ejer?.cprNummer || p?.cprNummer || p?.Personnummer;
        const cvr = p?.ejer?.cvrNummer || p?.cvrNummer;
        if (cpr) owners.push(String(cpr));
        if (cvr) owners.push(String(cvr));
      }
      return owners;
    } catch (e) {
      this.logger.warn('EJF-opslag fejlede: ' + String(e));
      return [];
    }
  }
}
