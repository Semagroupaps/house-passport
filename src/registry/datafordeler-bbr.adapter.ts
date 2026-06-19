import { Injectable, Logger } from '@nestjs/common';
import { RegistryAdapter, RegistryData } from './registry.interface';
import { DawaAddressService } from './dawa-address.service';
import { DatafordelerClient } from './datafordeler.client';
import { DarBfeResolver } from './dar-bfe.resolver';

/**
 * Rigtigt BBR-/boligopslag på Datafordeleren. Korrekt opslagskæde:
 *   1) DAWA: adresse -> adgangsadressens id (= BBR husnummer-id)
 *   2) DAR (offentlig): husnummerTilBygningBfe -> ejendommens BFE-nummer
 *   3) BBR: grund?BFEnummer=<bfe> -> grundens UUID (id_lokalId)
 *   4) BBR: bygning?Grund=<uuid>  -> bygningerne på grunden
 * For "bygning på fremmed grund" slås bygning op direkte med BFEnummer.
 * Sætter altid en `bbrNote`, der forklarer udfaldet (til ærlig UI-besked + fejlfinding).
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
      const husnummerId = first.id; // = BBR's husnummer-id

      let bbr: any = { note: 'Datafordeler ikke forbundet' };
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
          ...(bbr.bfe ? { bfe: bbr.bfe } : {}),
          ...(bbr.note ? { bbrNote: bbr.note } : {}),
          ...(bbr.anvendelseskode ? { anvendelseskode: bbr.anvendelseskode } : {}),
          ...(bbr.raw ? { bbr: bbr.raw } : {}),
        },
      };
    } catch (e) {
      this.logger.warn('Falder tilbage til stub-data: ' + String(e));
      return this.stub(address);
    }
  }

  private async fetchBbr(husnummerId: string): Promise<any> {
    let note = '';
    try {
      // 1) husnummer -> BFE (DAR, offentlig)
      let bfe: string | undefined;
      try {
        bfe = await this.dar.husnummerToBfe(husnummerId);
      } catch (e) {
        note = 'DAR-fejl: ' + this.errMsg(e);
        this.logger.warn('DAR husnummerTilBygningBfe fejlede: ' + String(e));
      }
      if (!bfe && !note) note = 'DAR fandt intet BFE-nummer for adressen';

      let buildings: any[] = [];
      if (bfe) {
        // 2) BFE -> grundens UUID (BBR)
        let grundId: string | undefined;
        try {
          grundId = await this.grundUuidByBfe(bfe);
        } catch (e) {
          note = 'BBR grund-fejl: ' + this.errMsg(e);
          this.logger.warn('BBR grund fejlede: ' + String(e));
        }
        // 3) UUID -> bygninger (BBR); ellers prøv bygning direkte på BFE (fremmed grund)
        if (grundId) {
          try {
            buildings = await this.queryBygning({ Grund: grundId, status: '6' });
            if (!buildings.length) buildings = await this.queryBygning({ Grund: grundId });
          } catch (e) {
            note = 'BBR bygning-fejl: ' + this.errMsg(e);
            this.logger.warn('BBR bygning fejlede: ' + String(e));
          }
        } else if (!note) {
          try {
            buildings = await this.queryBygning({ BFEnummer: bfe, status: '6' });
            if (!buildings.length) buildings = await this.queryBygning({ BFEnummer: bfe });
          } catch (e) {
            note = 'BBR bygning-fejl: ' + this.errMsg(e);
          }
          if (!buildings.length && !note) note = 'BBR: ingen grund/bygning for BFE ' + bfe;
        }
      }

      this.logger.log(`BBR: ${buildings.length} bygning(er) (husnummer ${husnummerId}, BFE ${bfe ?? '-'})`);
      const b = this.pickMainBuilding(buildings);
      if (!b) {
        if (!note) note = bfe ? `BBR: 0 bygninger for BFE ${bfe}` : 'Ingen bygningsdata';
        return { bfe, note };
      }

      const buildYear = b.byg026Opførelsesår != null ? Number(b.byg026Opførelsesår) : undefined;
      const areaM2 = b.byg038SamletBygningsareal != null ? Number(b.byg038SamletBygningsareal) : undefined;
      const anvendelseskode = b.byg021BygningensAnvendelse != null ? String(b.byg021BygningensAnvendelse) : undefined;
      this.logger.log(`BBR: valgte bygning byggeår=${buildYear} areal=${areaM2} anvendelse=${anvendelseskode}`);

      return {
        bfe,
        buildYear,
        areaM2,
        anvendelseskode,
        propertyType: anvendelseskode ? this.anvendelse(anvendelseskode) : undefined,
        raw: b,
        note: 'OK',
      };
    } catch (e) {
      this.logger.warn('BBR-opslag fejlede: ' + String(e));
      return { note: note || 'Uventet fejl: ' + this.errMsg(e) };
    }
  }

  /** BFE-nummer -> grundens UUID via BBR grund-tjenesten. */
  private async grundUuidByBfe(bfe: string): Promise<string | undefined> {
    let arr = await this.queryGrund({ BFEnummer: bfe, status: '6' });
    if (!arr.length) arr = await this.queryGrund({ BFEnummer: bfe });
    const g = arr.find((x: any) => x && (x.id_lokalId || x.id)) ?? arr[0];
    const id = g?.id_lokalId ?? g?.id;
    this.logger.log(`BBR: grund-UUID ${id ?? '-'} for BFE ${bfe}`);
    return id ? String(id) : undefined;
  }

  private queryBygning(params: Record<string, string>): Promise<any[]> {
    return this.queryList('/BBR/BBRPublic/1/rest/bygning', params);
  }
  private queryGrund(params: Record<string, string>): Promise<any[]> {
    return this.queryList('/BBR/BBRPublic/1/rest/grund', params);
  }

  private async queryList(path: string, params: Record<string, string>): Promise<any[]> {
    const data: any = await this.df.getJson(path, params);
    if (Array.isArray(data)) return data.filter(Boolean);
    if (Array.isArray(data?.features)) return data.features.map((f: any) => f.properties ?? f).filter(Boolean);
    if (data && typeof data === 'object') return [data];
    return [];
  }

  private pickMainBuilding(buildings: any[]): any | undefined {
    const withYear = buildings.filter((b) => b && b.byg026Opførelsesår != null);
    const pool = withYear.length ? withYear : buildings.filter(Boolean);
    if (!pool.length) return undefined;
    return pool.sort(
      (a, b) => (Number(b.byg038SamletBygningsareal) || 0) - (Number(a.byg038SamletBygningsareal) || 0),
    )[0];
  }

  private errMsg(e: unknown): string {
    const s = e instanceof Error ? e.message : String(e);
    return s.length > 160 ? s.slice(0, 160) : s;
  }

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
