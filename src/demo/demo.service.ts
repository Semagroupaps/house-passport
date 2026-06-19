import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { signToken } from '../auth/jwt';

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
        { propertyId: property.id, filename: 'Energimaerke_2022.pdf', category: 'Energi', source: 'registry', processingStatus: 'processed', s3Key: 'demo/em', encryptionKeyRef: 'demo' },
      ],
    });

    const anyAdmin = this.admin as any;
    const soon = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d; };
    await anyAdmin.maintenanceTask.createMany({
      data: [
        { propertyId: property.id, title: 'Servicér varmepumpe', category: 'VVS', priority: 'high', dueDate: soon(14), intervalMonths: 12 },
        { propertyId: property.id, title: 'Rens tagrender', category: 'Tag', priority: 'normal', dueDate: soon(40), intervalMonths: 6 },
        { propertyId: property.id, title: 'Test røgalarmer', category: 'Sikkerhed', priority: 'normal', dueDate: soon(-5), intervalMonths: 6 },
        { propertyId: property.id, title: 'Maling af vinduer (sydside)', category: 'Vedligehold', priority: 'low', dueDate: soon(120) },
        { propertyId: property.id, title: 'Eftersyn af elinstallation', category: 'El', priority: 'normal', status: 'done', completedAt: soon(-30) },
      ],
    });
    const years = (n: number) => { const d = new Date(); d.setFullYear(d.getFullYear() + n); return d; };
    await anyAdmin.warranty.createMany({
      data: [
        { propertyId: property.id, title: 'Tag — 10 års garanti', provider: 'HC Tag ApS', category: 'Tag', startDate: years(-2), endDate: years(8) },
        { propertyId: property.id, title: 'Varmepumpe', provider: 'Bosch', category: 'VVS', startDate: years(-1), endDate: years(4) },
        { propertyId: property.id, title: 'Elarbejde', provider: 'Aarhus El ApS', category: 'El', startDate: years(-3), endDate: years(2) },
      ],
    });
    this.logger.log(`Demo-session oprettet for ${person.id}`);
    return { token: signToken(person.id), personId: person.id, propertyId: property.id };
  }

  async onModuleDestroy() {
    await this.admin.$disconnect();
  }
}
