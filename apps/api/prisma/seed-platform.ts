import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const platformEmail = (
    process.env.PLATFORM_ADMIN_EMAIL || 'platform@prequaliq.com'
  )
    .trim()
    .toLowerCase();
  const platformPassword =
    process.env.PLATFORM_ADMIN_PASSWORD ||
    (process.env.NODE_ENV === 'production'
      ? (() => {
          throw new Error(
            'PLATFORM_ADMIN_PASSWORD must be configured before production seeding',
          );
        })()
      : 'platform123');

  await prisma.platformAdmin.upsert({
    where: { email: platformEmail },
    update: {
      name: 'Platform Admin',
      passwordHash: await bcrypt.hash(platformPassword, 12),
      active: true,
    },
    create: {
      email: platformEmail,
      name: 'Platform Admin',
      passwordHash: await bcrypt.hash(platformPassword, 12),
      active: true,
    },
  });

  await prisma.plan.upsert({
    where: { code: 'demo-trial-7d' },
    update: {
      name: 'Enterprise Hub Demo',
      interval: 'monthly',
      priceAed: 0,
      trialDays: 7,
      maxUsers: 3,
      active: true,
    },
    create: {
      name: 'Enterprise Hub Demo',
      code: 'demo-trial-7d',
      interval: 'monthly',
      priceAed: 0,
      trialDays: 7,
      maxUsers: 3,
      active: true,
    },
  });
  await prisma.plan.upsert({
    where: { code: 'standard' },
    update: {
      name: 'Standard',
      interval: 'monthly',
      priceAed: 499,
      trialDays: 14,
      maxUsers: 10,
      active: true,
    },
    create: {
      name: 'Standard',
      code: 'standard',
      interval: 'monthly',
      priceAed: 499,
      trialDays: 14,
      maxUsers: 10,
      active: true,
    },
  });
  await prisma.plan.upsert({
    where: { code: 'standard-yearly' },
    update: {
      name: 'Standard Yearly',
      interval: 'yearly',
      priceAed: 4990,
      trialDays: 14,
      maxUsers: 10,
      active: true,
    },
    create: {
      name: 'Standard Yearly',
      code: 'standard-yearly',
      interval: 'yearly',
      priceAed: 4990,
      trialDays: 14,
      maxUsers: 10,
      active: true,
    },
  });

  const category = await prisma.industryCategory.upsert({
    where: { code: 'marble' },
    update: { name: 'Marble & Stone', active: true },
    create: { code: 'marble', name: 'Marble & Stone', active: true },
  });
  const feature = await prisma.appFeature.upsert({
    where: { key: 'quotation.counter_top' },
    update: { label: 'Counter Top quotations', active: true },
    create: {
      key: 'quotation.counter_top',
      label: 'Counter Top quotations',
      active: true,
    },
  });
  await prisma.appFeatureOnCategory.upsert({
    where: {
      featureId_categoryId: {
        featureId: feature.id,
        categoryId: category.id,
      },
    },
    update: {},
    create: { featureId: feature.id, categoryId: category.id },
  });

  console.log(`Seeded platform data and admin ${platformEmail}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
