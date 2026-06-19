import { Injectable, Logger } from '@nestjs/common';
import { DatafordelerClient } from './datafordeler.client';

/**
 * DAR BFE — oversætter et husnummer-id til ejendommens BFE-nummer.
 * Kaldet autentificeres med samme API-key/tjenestebruger som BBR
 * (DAR-tjenesten afviser ellers med 403).
 */
@Injectable()
export class DarBfeResolver {
  private readonly logger = new Logger(DarBfeResolver.name);

  constructor(private readonly df: DatafordelerClient) {}

  /**
   * Husnummer-id -> BFE-nummer for den ejendom (typisk Samlet Fast Ejendom),
   * som bygningen ifølge BBR indgår i. Den rigtige metode for et almindeligt hus.
   */
  async husnummerToBfe(husnummerId: string): Promise<string | undefined> {
    const data = await this.df.getJson('/DAR/DAR_BFE_Public/1/rest/husnummerTilBygningBfe', { husnummerId });
    const bfe = this.findBfe(data);
    this.logger.log(`DAR: husnummer ${husnummerId} -> BFE ${bfe ?? '-'}`);
    return bfe;
  }

  /** Fallback for ejerlejligheder: adresse-id -> enhedens BFE-nummer. */
  async addressToBfe(adresseId: string): Promise<string | undefined> {
    const data = await this.df.getJson('/DAR/DAR_BFE_Public/1/rest/adresseTilEnhedBfe', { adresseId });
    return this.findBfe(data);
  }

  /** Find rekursivt det første numeriske BFE-nummer i et DAR-svar. */
  private findBfe(obj: any): string | undefined {
    let found: string | undefined;
    const visit = (o: any) => {
      if (found || o == null || typeof o !== 'object') return;
      for (const [k, v] of Object.entries(o)) {
        if (found) return;
        if (/bfe/i.test(k) && (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v)))) {
          found = String(v);
          return;
        }
        if (v && typeof v === 'object') visit(v);
      }
    };
    visit(obj);
    return found;
  }
}
