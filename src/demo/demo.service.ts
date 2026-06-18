import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * DEMO/DEV ONLY (aktiveres af DEMO_MODE=true). Opretter en demo-bruger + en
 * seedet, MitID-verificeret bolig med dokumenter, så den serverede forside kan
 * vise rigtige API-data uden en fuld auth-/onboarding-opsætning.
 *
 * Bruger en admin-forbindelse, fordi oprettelse af en Person normalt sker
 * out-of-band via auth-udbyderen (Clerk/Auth0). SKAL deaktiveres i produktion.
 */
@Injectable()
export class DemoService implements OnModuleDestroy {
  private readonly logger = new Logger(DemoService.name);
  private readonly admin = new PrismaClient({
    datasources: { db: { url: process.env.ADMIN_DATABASE_URL } },
  });

  async createSession() {
    const person = await this.admin.person.create({
      data: { displayName: 'Demo Bruger', isMitidVerified: true },
    });
    const property = await this.admin.property.create({
      data: {
        bfeNumber: `BFE-DEMO-${Date.now()}`,
        address: 'Æblevej 12',
        energyLabel: 'C',
        propertyType: 'Parcelhus',
        buildYear: 1974,
        bbrSnapshot: { areaM2: 142, heating: 'fjernvarme', estimatedValue: '3.240.000 kr.' },
      },
    });
    await this.admin.ownershipPeriod.create({
      data: { propertyId: property.id, personId: person.id, validFrom: new Date(), mitidVerified: true },
    });
    await this.admin.document.createMany({
      data: [
        { propertyId: property.id, filename: 'Elinstallationsrapport_2023.pdf', category: 'El', source: 'craftsman', processingStatus: 'processed', s3Key: 'demo/el', encryptionKeyRef: 'demo' },
        { propertyId: property.id, filename: 'Tagrapport_HCTag.pdf', category: 'Tag', source: 'craftsman', processingStatus: 'processed', s3Key: 'demo/tag', encryptionKeyRef: 'demo' },
        { propertyId: property.id, filename: 'Varmepumpe_garanti.pdf', category: 'Garanti', source: 'manual', processingStatus: 'processed', s3Key: 'demo/vp', encryptionKeyRef: 'demo' },
      ],
    });
    this.logger.log(`Demo-session oprettet for ${person.id}`);
    // token = personId (mock-auth-format: "personId[:orgId]")
    return { token: person.id, personId: person.id, propertyId: property.id };
  }

  async onModuleDestroy() {
    await this.admin.$disconnect();
  }
}
