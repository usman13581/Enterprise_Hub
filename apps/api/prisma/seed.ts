import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: 'binhaj-marble' },
    update: {
      name: 'Binhaj Marble',
    },
    create: {
      name: 'Binhaj Marble',
      slug: 'binhaj-marble',
      profile: {
        create: {
          legalName: 'Binhaj Marble LLC',
          tradeName: 'Binhaj Marble',
          address: 'United Arab Emirates',
          phone: '+971500000000',
          email: 'ops@binhajmarble.ae',
          trn: '100000000000003',
          quotationPrefix: 'BM-QT',
          invoicePrefix: 'BM-INV',
          jobPrefix: 'BM-JOB',
          advancePrefix: 'BM-ADV',
          creditNotePrefix: 'BM-CN',
          currency: 'AED',
        },
      },
    },
    include: { profile: true },
  });

  if (!company.profile) {
    await prisma.companyProfile.create({
      data: {
        companyId: company.id,
        legalName: 'Binhaj Marble LLC',
        tradeName: 'Binhaj Marble',
        address: 'United Arab Emirates',
        phone: '+971500000000',
        email: 'ops@binhajmarble.ae',
        trn: '100000000000003',
        quotationPrefix: 'BM-QT',
        invoicePrefix: 'BM-INV',
        jobPrefix: 'BM-JOB',
        advancePrefix: 'BM-ADV',
        creditNotePrefix: 'BM-CN',
        currency: 'AED',
      },
    });
  } else {
    await prisma.companyProfile.update({
      where: { companyId: company.id },
      data: {
        quotationPrefix: 'BM-QT',
        invoicePrefix: 'BM-INV',
        jobPrefix: 'BM-JOB',
        advancePrefix: 'BM-ADV',
        creditNotePrefix: 'BM-CN',
      },
    });
  }

  await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company.id,
        email: 'owner@binhajmarble.ae',
      },
    },
    update: {
      name: 'Binhaj Owner',
      active: true,
    },
    create: {
      companyId: company.id,
      email: 'owner@binhajmarble.ae',
      name: 'Binhaj Owner',
    },
  });

  console.log('Seeded Binhaj Marble company + owner');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
