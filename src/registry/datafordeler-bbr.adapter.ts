import { Injectable, Logger } from '@nestjs/common';
import { RegistryAdapter, RegistryData } from './registry.interface';
import { DawaAddressService } from './dawa-address.service';
import { DatafordelerClient } from './datafordeler.client';
import { DarBfeResolver } from './dar-bfe.resolver';

/**
 * Rigtigt BBR-/boligopslag på Datafordeleren.
 *
 * Primær vej: DAWA giver adgangsadressens id, som er det samme UUID, BBR bruger
 * som `husnummer`. Derfor slås bygningen direkte op med
 *   /BBR/BBRPublic/1/rest/bygning?Husnummer=<id>
 * Fallback: hvis husnummer ikke giver bygninger, slås grunden op via BFE
 *   (DAR -> BFE -> /rest/grund?BFEnummer=...) og dernæst bygninger på grundens UUID.
 *
 * Falder pænt tilbage, hvis et led mangler/fejler, så onboarding aldrig hård-fejler.
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
      const husnummerId = first.id; // = BBR's husnummer-reference

      let bbr: any = {};
      if (this.df.isConfigured()) {
        bbr = await this.fetchBbr(husnummerId);
      }

      return {
        bfeNumber: bbr.bfe || 'DAWA-' + first.id.slice(0, 8),
        address: resolved.betegnelse || first.tekst,
        energyLabel: bbr.energyLabel,
        propertyType: bbr.propertyType,
        buildYear: bbr.buildYear,
        bbrSnapshot: {
          source: this.df.isConfigured() ? 'datafordeler+dawa' : 'dawa',
          kommunekode: resolved.kommunekode,
          x: resolved.x,
          y: resolved.y,
          areaM2: bbr.areaM2,
          husnummerId,
          ...(bbr.anvendelseskode ? { anvendelseskode: bbr.anvendelseskode } : {}),
          ...(bbr.raw ? { bbr: bbr.raw } : {}),
        },
      };
    } catch (e) {
      this.logger.warn('Falder tilbage til stub-data: ' + String(e));
      return this.stub(address);
    }
  }

  /** Henter bygningsdata fra BBR — primært via husnummer, ellers via BFE/grund. */
  private async fetchBbr(husnummerId: string): Promise<any> {
    try {
      let buildings = await this.queryBygning({ Husnummer: husnummerId, status: '6' });
      if (!buildings.length) {
        this.logger.warn(`BBR: ingen bygninger (status=6) for husnummer ${husnummerId}; prøver uden status`);
        buildings = await this.queryBygning({ Husnummer: husnummerId });
      }
      if (!buildings.length) {
        this.logger.warn('BBR: husnummer gav 0 bygninger; prøver fallback via BFE/grund');
        try { buildings = await this.fetchByGrundViaBfe(husnummerId); }
        catch (e) { this.logger.warn('BBR grund-fallback fejlede: ' + String(e)); }
      }

      this.logger.log(`BBR: ${buildings.length} bygning(er) fundet for husnummer ${husnummerId}`);
      const b = this.pickMainBuilding(buildings);
      if (!b) return {};

      const buildYear = b.byg026Opførelsesår != null ? Number(b.byg026Opførelsesår) : undefined;
      const areaM2 = b.byg038SamletBygningsareal != null ? Number(b.byg038SamletBygningsareal) : undefined;
      const anvendelseskode = b.byg021BygningensAnvendelse != null ? String(b.byg021BygningensAnvendelse) : undefined;
      this.logger.log(`BBR: valgte bygning byggeår=${buildYear} areal=${areaM2} anvendelse=${anvendelseskode}`);

      return {
        buildYear,
        areaM2,
        anvendelseskode,
        propertyType: anvendelseskode ? this.anvendelse(anvendelseskode) : undefined,
        raw: b,
      };
    } catch (e) {
      this.logger.warn('BBR-opslag fejlede: ' + String(e));
      return {};
    }
  }

  /** Kalder bygning-tjenesten og normaliserer svaret til et array. */
  private async queryBygning(params: Record<string, string>): Promise<any[]> {
    const data: any = await this.df.getJson('/BBR/BBRPublic/1/rest/bygning', params);
    if (Array.isArray(data)) return data.filter(Boolean);
    if (Array.isArray(data?.features)) return data.features.map((f: any) => f.properties ?? f).filter(Boolean);
    if (data && typeof data === 'object') return [data];
    return [];
  }

  /** Fallback: DAR -> BFE -> grund (UUID) -> bygninger på grunden. */
  private async fetchByGrundViaBfe(husnummerId: string): Promise<any[]> {
    const bfe = await this.dar.addressToBfe(husnummerId);
    if (!bfe) return [];
    const grundData: any = await this.df.getJson('/BBR/BBRPublic/1/rest/grund', { BFEnummer: bfe, status: '6' });
    const grund = Array.isArray(grundData) ? grundData[0] : (grundData?.[0] ?? grundData);
    const grundId = grund?.id_lokalId ?? grund?.id;
    if (!grundId) return [];
    this.logger.log(`BBR: grund ${grundId} via BFE ${bfe}`);
    return this.queryBygning({ Grund: String(grundId), status: '6' });
  }

  /** Vælger den primære bygning: størst samlet areal blandt dem med et opførelsesår. */
  private pickMainBuilding(buildings: any[]): any | undefined {
    const withYear = buildings.filter((b) => b && b.byg026Opførelsesår != null);
    const pool = withYear.length ? withYear : buildings.filter(Boolean);
    if (!pool.length) return undefined;
    return pool.sort(
      (a, b) => (Number(b.byg038SamletBygningsareal) || 0) - (Number(a.byg038SamletBygningsareal) || 0),
    )[0];
  }

  /** Konservativ oversættelse af de mest almindelige BBR-anvendelseskoder. */
  private anvendelse(code: string): string {
    const m: Record<string, string> = {
      '110': 'Stuehus til landbrug',
      '120': 'Fritliggende enfamiliehus',
      '121': 'Sammenbygget enfamiliehus',
      '122': 'Fritliggende enfamiliehus (tæt-lav)',
      '130': 'Række-/kæde-/dobbelthus',
      '131': 'Række-/kæde-/dobbelthus',
      '132': 'Dobbelthus',
      '140': 'Etagebolig (flerfamiliehus)',
      '150': 'Kollegium',
      '160': 'Døgninstitution',
      '190': 'Anden bygning til helårsbeboelse',
      '510': 'Sommerhus',
      '540': 'Kolonihavehus',
    };
    return m[code] || ('Anvendelseskode ' + code);
  }

  private stub(address: string): RegistryData {
    const seed = Buffer.from(address).toString('hex').slice(0, 8);
    return {
      bfeNumber: `BFE-${seed}`,
      address,
      energyLabel: 'C',
      propertyType: 'parcelhus',
      buildYear: 1974,
      bbrSnapshot: { areaM2: 142, heating: 'fjernvarme', source: 'stub' },
    };
  }
}
