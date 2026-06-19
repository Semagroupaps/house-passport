import { Injectable } from '@nestjs/common';
import { DatafordelerClient } from './datafordeler.client';

/** DAR_BFE_Public: oversætter et adresse-id til ejendommens BFE-nummer. */
@Injectable()
export class DarBfeResolver {
  constructor(private readonly df: DatafordelerClient) {}

  async addressToBfe(adresseId: string): Promise<string | undefined> {
    const data: any = await this.df.getJson('/DAR/DAR_BFE_Public/1/rest/adresseTilEnhedBfe', { adresseId });
    const bfe = data?.BFEnummer ?? data?.bfeNummer ?? (Array.isArray(data) ? data[0]?.BFEnummer : undefined);
    return bfe != null ? String(bfe) : undefined;
  }
}
