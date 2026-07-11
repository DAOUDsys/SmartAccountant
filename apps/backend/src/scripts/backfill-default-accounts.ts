import { PrismaClient } from '@prisma/client';
import { createDefaultAccountsForBusiness } from '../features/accounts/account-defaults';

async function main() {
  const prisma = new PrismaClient();

  try {
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true },
      where: { deletedAt: null },
    });

    for (const business of businesses) {
      await createDefaultAccountsForBusiness(prisma, business.id);
      console.log(`Backfilled default accounts for ${business.name} (${business.id}).`);
    }

    console.log(`Backfilled default account configuration for ${businesses.length} businesses.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
