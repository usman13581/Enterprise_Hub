import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type PlanSeed = {
  code: string;
  name: string;
  interval: 'monthly' | 'yearly';
  priceUsd: number;
  trialDays: number;
  /** 0 = unlimited (Custom / contact sales) */
  maxUsers: number;
  active: boolean;
};

/** Commercial + demo plans shown in platform admin. */
const PLANS: PlanSeed[] = [
  {
    code: 'demo-trial-7d',
    name: 'Enterprise Hub Demo',
    interval: 'monthly',
    priceUsd: 0,
    trialDays: 7,
    maxUsers: 3,
    active: true,
  },
  {
    code: 'basic',
    name: 'Basic',
    interval: 'monthly',
    priceUsd: 49,
    trialDays: 14,
    maxUsers: 1,
    active: true,
  },
  {
    code: 'basic-yearly',
    name: 'Basic Yearly',
    interval: 'yearly',
    priceUsd: 499,
    trialDays: 14,
    maxUsers: 1,
    active: true,
  },
  {
    code: 'standard',
    name: 'Standard',
    interval: 'monthly',
    priceUsd: 99,
    trialDays: 14,
    maxUsers: 10,
    active: true,
  },
  {
    code: 'standard-yearly',
    name: 'Standard Yearly',
    interval: 'yearly',
    priceUsd: 949,
    trialDays: 14,
    maxUsers: 10,
    active: true,
  },
  {
    code: 'custom',
    name: 'Custom',
    interval: 'monthly',
    priceUsd: 0,
    trialDays: 0,
    maxUsers: 0,
    active: true,
  },
];

async function upsertPlan(plan: PlanSeed) {
  await prisma.plan.upsert({
    where: { code: plan.code },
    update: {
      name: plan.name,
      interval: plan.interval,
      priceUsd: plan.priceUsd,
      trialDays: plan.trialDays,
      maxUsers: plan.maxUsers,
      active: plan.active,
    },
    create: plan,
  });
}

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

  for (const plan of PLANS) {
    await upsertPlan(plan);
  }

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
  console.log(
    'Plans: Basic $49/mo (1 user), Basic Yearly $499, Standard $99/mo (10 users), Standard Yearly $949, Custom (contact sales).',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
