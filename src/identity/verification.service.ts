import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { TenantService } from '../tenant/tenant.service';
import { TenantContext } from '../tenant/tenant-context';
import { MITID_BROKER, MitIdBroker } from './mitid-broker.interface';
import { OWNERSHIP_REGISTRY, OwnershipRegistryAdapter } from '../registry/ownership-registry.interface';
import { matchesRegisteredOwner } from './ownership-matching';
import { PendingVerificationStore } from './pending-verification.store';

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Ejerverificering: at logge ind != at bevise ejerskab. Brugeren sendes til
 * MitID-brokeren (OIDC). Når den verificerede identitet matcher den registrerede
 * ejer af BFE-nummeret, sættes ownership_period.mitid_verified = true — flaget
 * der gør dataene B2B-værdifulde og låser ejerskifte op.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly tenant: TenantService,
    @Inject(MITID_BROKER) private readonly broker: MitIdBroker,
    @Inject(OWNERSHIP_REGISTRY) private readonly ownerRegistry: OwnershipRegistryAdapter,
    private readonly pending: PendingVerificationStore,
  ) {}

  /** Starter MitID-flowet og returnerer den URL, browseren skal sendes til. */
  async initiate(ctx: TenantContext, propertyId: string) {
    const state = b64url(randomBytes(16));
    const nonce = b64url(randomBytes(16));
    const codeVerifier = b64url(randomBytes(32));
    const codeChallenge = b64url(createHash('sha256').update(codeVerifier).digest());
    this.pending.put(state, { personId: ctx.personId as string, propertyId, codeVerifier, nonce });
    const redirectUrl = await this.broker.buildAuthorizeUrl({ state, nonce, codeChallenge });
    return { redirectUrl, simulated: !this.broker.isConfigured() };
  }

  /** Håndterer brokerens callback: udveksler koden, matcher ejer, sætter flaget. */
  async handleCallback(code: string, state: string) {
    const pend = this.pending.take(state);
    if (!pend) throw new BadRequestException('Ugyldig eller udløbet verifikationssession');

    const identity = await this.broker.exchangeCode({ code, codeVerifier: pend.codeVerifier, nonce: pend.nonce });
    if (identity.assuranceLevel === 'low') {
      throw new ForbiddenException('Utilstrækkeligt MitID-sikkerhedsniveau');
    }

    // Kontekst udledes af den session, vi selv bandt til den indloggede bruger ved initiate.
    const ctx: TenantContext = { personId: pend.personId };
    return this.tenant.withTenant(ctx, async (tx) => {
      const property = await tx.property.findUnique({ where: { id: pend.propertyId } });
      if (!property) throw new NotFoundException();

      // Ejer-match køres mod det autoritative register i rigtig (konfigureret) tilstand.
      if (this.broker.isConfigured()) {
        const owners = await this.ownerRegistry.lookupOwner(property.bfeNumber);
        if (!matchesRegisteredOwner(identity.authoritativeId, owners)) {
          throw new ForbiddenException('MitID-identitet matcher ikke den registrerede ejer');
        }
      }

      await tx.ownershipPeriod.updateMany({
        where: { propertyId: pend.propertyId, personId: pend.personId, validTo: null },
        data: { mitidVerified: true },
      });
      await tx.person.update({ where: { id: pend.personId }, data: { isMitidVerified: true } });
      return { verified: true, propertyId: pend.propertyId, name: identity.name };
    });
  }
}
