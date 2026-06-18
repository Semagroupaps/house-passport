import { AsyncLocalStorage } from 'node:async_hooks';

/** Aktørens kontekst, udledt serverside fra et betroet token — aldrig fra klient-input. */
export interface TenantContext {
  personId?: string;
  orgId?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function currentContext(): TenantContext {
  return tenantStorage.getStore() ?? {};
}
