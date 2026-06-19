import { Injectable } from '@nestjs/common';

export interface AddressSuggestion { tekst: string; id: string }
export interface ResolvedAddress { betegnelse: string; kommunekode?: string; x?: number; y?: number; matrikelnr?: string }

/**
 * DAWA (api.dataforsyningen.dk) — Danmarks Adressers Web API. Gratis, ingen
 * credentials (valgfri token). Bruges til adresse-autocomplete og til at
 * resolve en adgangsadresse (-> id, kommune, koordinater). DAWA udfases aug. 2026;
 * basen er konfigurerbar, så vi kan pege på Dataforsyningens efterfølger.
 */
@Injectable()
export class DawaAddressService {
  private readonly base = (process.env.DAWA_BASE_URL || 'https://api.dataforsyningen.dk').replace(/\/$/, '');
  private readonly token = process.env.DATAFORSYNING_TOKEN || '';

  private url(path: string, params: Record<string, string>): string {
    const u = new URL(this.base + path);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
    if (this.token) u.searchParams.set('token', this.token);
    return u.toString();
  }

  async autocomplete(q: string): Promise<AddressSuggestion[]> {
    if (!q || q.trim().length < 2) return [];
    const r = await fetch(this.url('/adgangsadresser/autocomplete', { q, per_side: '8' }));
    if (!r.ok) throw new Error('DAWA autocomplete ' + r.status);
    const arr = (await r.json()) as any[];
    return arr.map((a) => ({ tekst: a.tekst, id: a.adgangsadresse?.id || a.id })).filter((s) => s.id);
  }

  async resolve(adgangsadresseId: string): Promise<ResolvedAddress> {
    const r = await fetch(this.url('/adgangsadresser/' + adgangsadresseId, {}));
    if (!r.ok) throw new Error('DAWA resolve ' + r.status);
    const a: any = await r.json();
    const betegnelse = a.betegnelse ||
      `${a.vejstykke?.navn || ''} ${a.husnr || ''}, ${a.postnummer?.nr || ''} ${a.postnummer?.navn || ''}`.replace(/\s+/g, ' ').trim();
    return {
      betegnelse,
      kommunekode: a.kommune?.kode,
      x: a.adgangspunkt?.koordinater?.[0],
      y: a.adgangspunkt?.koordinater?.[1],
      matrikelnr: a.matrikelnr,
    };
  }
}
