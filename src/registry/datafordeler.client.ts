import { Injectable } from '@nestjs/common';

/**
 * Klient til Datafordeleren (services.datafordeler.dk). Tjenestebruger via
 * username/password sættes i miljøet (certifikat kan tilføjes senere).
 * DAR_BFE_Public virker uden credentials; BBR/EJF kræver tjenestebruger.
 */
@Injectable()
export class DatafordelerClient {
  private readonly base = (process.env.DATAFORDELER_BASE_URL || 'https://services.datafordeler.dk').replace(/\/$/, '');
  private readonly user = process.env.DATAFORDELER_USERNAME || '';
  private readonly pass = process.env.DATAFORDELER_PASSWORD || '';
  private readonly apiKey = process.env.DATAFORDELER_API_KEY || '';

  isConfigured(): boolean {
    return !!(this.apiKey || (this.user && this.pass));
  }

  async getJson(path: string, params: Record<string, string | undefined>): Promise<any> {
    const u = new URL(this.base + path);
    u.searchParams.set('format', 'json');
    // Ny, fremtidssikret metode: API-key i URL'en (Datafordeler Administration).
    // Ellers den gamle tjenestebruger (brugernavn/adgangskode) — udfases ultimo 2026.
    if (this.apiKey) {
      u.searchParams.set('api-key', this.apiKey);
    } else {
      if (this.user) u.searchParams.set('username', this.user);
      if (this.pass) u.searchParams.set('password', this.pass);
    }
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, String(v));
    const r = await fetch(u.toString());
    if (!r.ok) throw new Error('Datafordeler ' + path + ' ' + r.status);
    return r.json();
  }
}
