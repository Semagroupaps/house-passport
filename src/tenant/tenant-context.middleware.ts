import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { AUTH_PROVIDER, AuthProvider } from '../auth/auth-provider.interface';
import { tenantStorage, TenantContext } from './tenant-context';

/**
 * Udleder aktørens kontekst serverside fra Authorization-headeren og kører
 * resten af requesten inde i AsyncLocalStorage, så enhver service kan læse
 * konteksten uden at den plumbes manuelt. Klient-input kan ALDRIG sætte
 * tenant-konteksten direkte.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(@Inject(AUTH_PROVIDER) private readonly auth: AuthProvider) {}

  async use(req: any, _res: any, next: () => void): Promise<void> {
    const header: unknown = req?.headers?.['authorization'];
    let ctx: TenantContext = {};
    if (typeof header === 'string') {
      const token = header.replace(/^Bearer\s+/i, '');
      try {
        const actor = await this.auth.verify(token);
        ctx = { personId: actor.personId, orgId: actor.orgId };
      } catch {
        ctx = {};
      }
    }
    tenantStorage.run(ctx, () => next());
  }
}
