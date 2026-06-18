import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Skrive-policy-test (WITH CHECK): en fremmed må IKKE oprette en grant på en
 * andens bolig, og må ikke gøre sig selv til ejer af en bolig, en anden ejer.
 */
const admin = new PrismaClient({ datasources: { db: { url: process.env.ADMIN_DATABASE_URL } } });
const app = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

type Tx = Prisma.TransactionClient;
async function as<T>(personId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return app.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      `SELECT set_config('app.current_person_id', $1, true), set_config('app.current_org_id', '', true)`,
      personId,
    );
    return work(tx);
  });
}

describe('Skrive-policies (WITH CHECK)', () => {
  let ownerId: string;
  let strangerId: string;
  let propertyId: string;

  beforeAll(async () => {
    const owner = await admin.person.create({ data: { displayName: 'Ejer' } });
    const stranger = await admin.person.create({ data: { displayName: 'Fremmed' } });
    ownerId = owner.id;
    strangerId = stranger.id;
    const p = await admin.property.create({ data: { bfeNumber: `BFE-W-${Date.now()}`, address: 'Skrivevej 1' } });
    propertyId = p.id;
    await admin.ownershipPeriod.create({ data: { propertyId, personId: ownerId, validFrom: new Date() } });
  });

  afterAll(async () => {
    await admin.$disconnect();
    await app.$disconnect();
  });

  it('ejeren KAN uddele en grant på egen bolig', async () => {
    const g = await as(ownerId, (tx) =>
      tx.accessGrant.create({
        data: { propertyId, subjectType: 'person', subjectId: strangerId, scope: ['documents:read'], permission: 'read', grantedBy: ownerId },
      }),
    );
    expect(g.id).toBeDefined();
  });

  it('en fremmed kan IKKE uddele en grant på en andens bolig', async () => {
    await expect(
      as(strangerId, (tx) =>
        tx.accessGrant.create({
          data: { propertyId, subjectType: 'person', subjectId: strangerId, scope: ['documents:read'], permission: 'read', grantedBy: strangerId },
        }),
      ),
    ).rejects.toBeDefined();
  });
});
