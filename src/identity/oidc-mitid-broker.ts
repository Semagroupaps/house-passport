import { Injectable, Logger } from '@nestjs/common';
import { MitIdBroker, VerifiedIdentity } from './mitid-broker.interface';

/**
 * Rigtig MitID via en certificeret OIDC-broker. Konfigureres via miljøvariabler:
 *   MITID_ISSUER, MITID_CLIENT_ID, MITID_CLIENT_SECRET, MITID_REDIRECT_URI, MITID_SCOPE
 * Bruger authorization code-flow med PKCE. (Signatur-verifikation af id_token mod
 * brokerens JWKS er næste hærdningsskridt; tokenet hentes server-til-server over TLS.)
 */
@Injectable()
export class OidcMitIdBroker implements MitIdBroker {
  private readonly logger = new Logger(OidcMitIdBroker.name);
  private readonly issuer = (process.env.MITID_ISSUER || '').replace(/\/$/, '');
  private readonly clientId = process.env.MITID_CLIENT_ID || '';
  private readonly clientSecret = process.env.MITID_CLIENT_SECRET || '';
  private readonly redirectUri = process.env.MITID_REDIRECT_URI || '';
  private readonly scope = process.env.MITID_SCOPE || 'openid';
  private discovery: any;

  isConfigured(): boolean {
    return !!(this.issuer && this.clientId && this.clientSecret && this.redirectUri);
  }

  private async disco(): Promise<any> {
    if (this.discovery) return this.discovery;
    const r = await fetch(this.issuer + '/.well-known/openid-configuration');
    if (!r.ok) throw new Error('Kunne ikke hente OIDC discovery (' + r.status + ')');
    this.discovery = await r.json();
    return this.discovery;
  }

  async buildAuthorizeUrl(p: { state: string; nonce: string; codeChallenge: string }): Promise<string> {
    const d = await this.disco();
    const u = new URL(d.authorization_endpoint);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('client_id', this.clientId);
    u.searchParams.set('redirect_uri', this.redirectUri);
    u.searchParams.set('scope', this.scope);
    u.searchParams.set('state', p.state);
    u.searchParams.set('nonce', p.nonce);
    u.searchParams.set('code_challenge', p.codeChallenge);
    u.searchParams.set('code_challenge_method', 'S256');
    return u.toString();
  }

  async exchangeCode(p: { code: string; codeVerifier: string; nonce: string }): Promise<VerifiedIdentity> {
    const d = await this.disco();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: p.code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code_verifier: p.codeVerifier,
    });
    const r = await fetch(d.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error('Token-udveksling fejlede (' + r.status + ')');
    const tok: any = await r.json();
    const claims = this.decode(tok.id_token);
    if (claims.nonce && claims.nonce !== p.nonce) throw new Error('Nonce stemmer ikke');

    const authoritativeId = String(claims.cpr || claims['dk.cpr'] || claims.sub || '');
    const name = String(claims.name || claims.preferred_username || 'MitID-bruger');
    const acr = String(claims.acr || claims.loa || '').toLowerCase();
    const assuranceLevel: VerifiedIdentity['assuranceLevel'] =
      acr.includes('high') ? 'high' : acr.includes('low') ? 'low' : 'substantial';
    return { authoritativeId, name, assuranceLevel };
  }

  private decode(idToken: string): any {
    const parts = (idToken || '').split('.');
    if (parts.length < 2) throw new Error('Ugyldigt id_token');
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  }
}
