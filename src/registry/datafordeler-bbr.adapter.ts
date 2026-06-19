import { Injectable, Logger } from '@nestjs/common';
import { RegistryAdapter, RegistryData } from './registry.interface';
import { DawaAddressService } from './dawa-address.service';
import { DatafordelerClient } from './datafordeler.client';
import { DarBfeResolver } from './dar-bfe.resolver';

/**
 * Rigtig BBR-/boligopslag: DAWA (adresse -> id) -> DAR (id -> BFE) -> BBR (BFE ->
 * bygningsdata) på Datafordeleren. Falder pænt tilbage, hvis et led mangler/fejler,
 * så onboarding aldrig hård-fejler. BBR-feltnavne (byg026/byg038 m.fl.) bør
 * verificeres mod live-svar fra din tjenestebruger.
 */
@Injectable()
export class DatafordelerBbrAdapter implements RegistryAdapter {
  private readonly logger = new Logger(DatafordelerBbrAdapter.name);

  constructor(
    private readonly dawa: DawaAddressService,
    private readonly df: DatafordelerClient,
    private readonly dar: DarBfeResolver,
  ) {}

  async lookupByAddress(address: string): Promise<RegistryData> {
    try {
      const sug = await this.dawa.autocomplete(address);
      const first = sug[0];
      if (!first) throw new Error('Adressen blev ikke fundet i DAWA');
      const resolved = await this.dawa.resolve(first.id);

      let bfe: string | undefined;
      try { bfe = await this.dar.addressToBfe(first.id); }
      catch (e) { this.logger.warn('DAR BFE-opslag fejlede: ' + String(e)); }

      let bbr: any = {};
      if (this.df.isConfigured() && bfe) {
        try { bbr = await this.fetchBbr(bfe); }
        catch (e) { this.logger.warn('BBR-opslag fejlede: ' + String(e)); }
      }

      return {
        bfeNumber: bfe || 'DAWA-' + first.id.slice(0, 8),
        address: resolved.betegnelse || first.tekst,
        energyLabel: bbr.energyLabel,
        propertyType: bbr.propertyType,
        buildYear: bbr.buildYear,
        bbrSnapshot: {
          source: this.df.isConfigured() ? 'datafordeler+dawa' : 'dawa',
          kommunekode: resolved.kommunekode,
          x: resolved.x, y: resolved.y,
          areaM2: bbr.areaM2,
          ...(bbr.raw ? { bbr: bbr.raw } : {}),
        },
      };
    } catch (e) {
      this.logger.warn('Falder tilbage til stub-data: ' + String(e));
      return this.stub(address);
    }
  }

  private async fetchBbr(bfe: string): Promise<any> {
    const data: any = await this.df.getJson('/BBR/BBRPublic/1/rest/bygning', { BFENr: bfe });
    const b = Array.isArray(data) ? data[0] : data?.features?.[0]?.properties || data?.[0] || data;
    if (!b) return {};
    return {
      buildYear: b.byg026Opførelsesår ? Number(b.byg026Opførelsesår) : undefined,
      areaM2: b.byg038SamletBygningsareal ? Number(b.byg038SamletBygningsareal) : undefined,
      propertyType: b.byg021BygningensAnvendelse ? String(b.byg021BygningensAnvendelse) : undefined,
      raw: b,
    };
  }

  private stub(address: string): RegistryData {
    const seed = Buffer.from(address).toString('hex').slice(0, 8);
    return {
      bfeNumber: `BFE-${seed}`, address,
      energyLabel: 'C', propertyType: 'parcelhus', buildYear: 1974,
      bbrSnapshot: { areaM2: 142, heating: 'fjernvarme', source: 'stub' },
    };
  }
}
