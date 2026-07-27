import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the Binhaj Marble pilot tenant with catalog data and one completed
 * quotation → job → advance → progressive invoice story so staging / demos
 * are not empty shells.
 */
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
          address:
            'Warehouse 12, Al Quoz Industrial Area 3, Dubai, United Arab Emirates',
          phone: '+97145001234',
          email: 'ops@binhajmarble.ae',
          trn: '100000000000003',
          bankDetails: 'Emirates NBD · AED · IBAN AE070331234567890123456',
          quotationPrefix: 'BM-QT',
          invoicePrefix: 'BM-INV',
          jobPrefix: 'BM-JOB',
          advancePrefix: 'BM-ADV',
          creditNotePrefix: 'BM-CN',
          currency: 'AED',
          vatRate: 0.05,
        },
      },
    },
    include: { profile: true },
  });

  await prisma.companyProfile.upsert({
    where: { companyId: company.id },
    update: {
      legalName: 'Binhaj Marble LLC',
      tradeName: 'Binhaj Marble',
      address:
        'Warehouse 12, Al Quoz Industrial Area 3, Dubai, United Arab Emirates',
      phone: '+97145001234',
      email: 'ops@binhajmarble.ae',
      trn: '100000000000003',
      bankDetails: 'Emirates NBD · AED · IBAN AE070331234567890123456',
      quotationPrefix: 'BM-QT',
      invoicePrefix: 'BM-INV',
      jobPrefix: 'BM-JOB',
      advancePrefix: 'BM-ADV',
      creditNotePrefix: 'BM-CN',
      currency: 'AED',
      vatRate: 0.05,
    },
    create: {
      companyId: company.id,
      legalName: 'Binhaj Marble LLC',
      tradeName: 'Binhaj Marble',
      address:
        'Warehouse 12, Al Quoz Industrial Area 3, Dubai, United Arab Emirates',
      phone: '+97145001234',
      email: 'ops@binhajmarble.ae',
      trn: '100000000000003',
      bankDetails: 'Emirates NBD · AED · IBAN AE070331234567890123456',
      quotationPrefix: 'BM-QT',
      invoicePrefix: 'BM-INV',
      jobPrefix: 'BM-JOB',
      advancePrefix: 'BM-ADV',
      creditNotePrefix: 'BM-CN',
      currency: 'AED',
      vatRate: 0.05,
    },
  });

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

  const italianStone = await prisma.supplier.upsert({
    where: { id: 'seed-supplier-italian' },
    update: {
      name: 'Carrara Stone Export SRL',
      contact: 'Marco Bianchi',
      phone: '+390585551234',
      email: 'export@carrarastone.example',
      address: 'Via Carrara 18, Massa-Carrara, Italy',
      active: true,
    },
    create: {
      id: 'seed-supplier-italian',
      companyId: company.id,
      name: 'Carrara Stone Export SRL',
      contact: 'Marco Bianchi',
      phone: '+390585551234',
      email: 'export@carrarastone.example',
      address: 'Via Carrara 18, Massa-Carrara, Italy',
      notes: 'Primary Italian marble supplier for Binhaj pilot.',
      active: true,
    },
  });

  const omanQuarry = await prisma.supplier.upsert({
    where: { id: 'seed-supplier-oman' },
    update: {
      name: 'Hajar Al Abyad Quarries',
      contact: 'Said Al Balushi',
      phone: '+96824550111',
      email: 'sales@hajarabyad.example',
      active: true,
    },
    create: {
      id: 'seed-supplier-oman',
      companyId: company.id,
      name: 'Hajar Al Abyad Quarries',
      contact: 'Said Al Balushi',
      phone: '+96824550111',
      email: 'sales@hajarabyad.example',
      address: 'Nizwa Industrial Zone, Oman',
      notes: 'Omani limestone and beige marble.',
      active: true,
    },
  });

  const calacatta = await prisma.product.upsert({
    where: { id: 'seed-product-calacatta' },
    update: {
      name: 'Calacatta Gold',
      sku: 'CAL-GOLD-20',
      unit: 'sqm',
      purchasePrice: 420,
      sellPrice: 780,
      supplierId: italianStone.id,
      active: true,
    },
    create: {
      id: 'seed-product-calacatta',
      companyId: company.id,
      supplierId: italianStone.id,
      name: 'Calacatta Gold',
      sku: 'CAL-GOLD-20',
      unit: 'sqm',
      purchasePrice: 420,
      sellPrice: 780,
      description: 'Bookmatched Calacatta slabs, 2cm polished.',
      active: true,
    },
  });

  await prisma.product.upsert({
    where: { id: 'seed-product-emperador' },
    update: {
      name: 'Emperador Dark',
      sku: 'EMP-DRK-20',
      purchasePrice: 180,
      sellPrice: 340,
      supplierId: italianStone.id,
      active: true,
    },
    create: {
      id: 'seed-product-emperador',
      companyId: company.id,
      supplierId: italianStone.id,
      name: 'Emperador Dark',
      sku: 'EMP-DRK-20',
      unit: 'sqm',
      purchasePrice: 180,
      sellPrice: 340,
      description: 'Spanish Emperador, 2cm honed.',
      active: true,
    },
  });

  await prisma.product.upsert({
    where: { id: 'seed-product-oman-beige' },
    update: {
      name: 'Oman Beige',
      sku: 'OMN-BGE-30',
      purchasePrice: 95,
      sellPrice: 210,
      supplierId: omanQuarry.id,
      active: true,
    },
    create: {
      id: 'seed-product-oman-beige',
      companyId: company.id,
      supplierId: omanQuarry.id,
      name: 'Oman Beige',
      sku: 'OMN-BGE-30',
      unit: 'sqm',
      purchasePrice: 95,
      sellPrice: 210,
      description: 'Local beige marble, 3cm.',
      active: true,
    },
  });

  const villaCustomer = await prisma.customer.upsert({
    where: { id: 'seed-customer-villa' },
    update: {
      name: 'Al Noor Villa Fit-out',
      contact: 'Fatima Al Noor',
      phone: '+971501234567',
      email: 'fatima@alnoorvilla.example',
      address: 'Palm Jumeirah, Dubai',
      trn: '100200300400003',
      active: true,
    },
    create: {
      id: 'seed-customer-villa',
      companyId: company.id,
      name: 'Al Noor Villa Fit-out',
      contact: 'Fatima Al Noor',
      phone: '+971501234567',
      email: 'fatima@alnoorvilla.example',
      address: 'Palm Jumeirah, Dubai',
      trn: '100200300400003',
      notes: 'Pilot villa kitchen + bathrooms.',
      active: true,
    },
  });

  await prisma.customer.upsert({
    where: { id: 'seed-customer-hotel' },
    update: {
      name: 'Bayview Hotel Lobby Refresh',
      contact: 'Procurement Desk',
      phone: '+97142109876',
      email: 'procurement@bayview.example',
      active: true,
    },
    create: {
      id: 'seed-customer-hotel',
      companyId: company.id,
      name: 'Bayview Hotel Lobby Refresh',
      contact: 'Procurement Desk',
      phone: '+97142109876',
      email: 'procurement@bayview.example',
      address: 'Corniche Road, Abu Dhabi',
      notes: 'Second pilot prospect — quotation only.',
      active: true,
    },
  });

  // One finished money path for Al Noor Villa (idempotent by fixed ids).
  const existingQuote = await prisma.quotation.findUnique({
    where: { id: 'seed-quotation-villa' },
  });

  if (!existingQuote) {
    const qty = 25;
    const purchasePrice = 420;
    const sellPrice = 780;
    const subtotal = qty * sellPrice;
    const purchaseTotal = qty * purchasePrice;
    const vatAmount = Number((subtotal * 0.05).toFixed(2));
    const total = Number((subtotal + vatAmount).toFixed(2));

    await prisma.quotation.create({
      data: {
        id: 'seed-quotation-villa',
        companyId: company.id,
        customerId: villaCustomer.id,
        number: 'BM-QT-0001',
        status: 'approved',
        title: 'Villa kitchen island + vanity tops',
        notes: 'Includes templating visit.',
        subtotal,
        vatAmount,
        total,
        purchaseTotal,
        approvedAt: new Date(),
        lines: {
          create: [
            {
              id: 'seed-quotation-villa-line-1',
              productId: calacatta.id,
              description: 'Calacatta Gold — kitchen island',
              unit: 'sqm',
              qty,
              purchasePrice,
              sellPrice,
              lineTotal: subtotal,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    await prisma.job.create({
      data: {
        id: 'seed-job-villa',
        companyId: company.id,
        customerId: villaCustomer.id,
        quotationId: 'seed-quotation-villa',
        number: 'BM-JOB-0001',
        status: 'open',
        title: 'Villa kitchen island + vanity tops',
        jobValue: total,
        jobNet: subtotal,
        purchaseTotal,
      },
    });

    await prisma.advancePayment.create({
      data: {
        id: 'seed-advance-villa',
        companyId: company.id,
        customerId: villaCustomer.id,
        jobId: 'seed-job-villa',
        number: 'BM-ADV-0001',
        amount: 8000,
        allocatedAmount: 8000,
        method: 'bank_transfer',
        reference: 'TRX-PILOT-001',
        notes: 'Mobilisation advance',
      },
    });

    const progressiveSubtotal = Number((subtotal * 0.4).toFixed(2));
    const progressiveVat = Number((progressiveSubtotal * 0.05).toFixed(2));
    const progressiveTotal = Number(
      (progressiveSubtotal + progressiveVat).toFixed(2),
    );
    const advanceApplied = 8000;
    const netPayable = Number(
      Math.max(0, progressiveTotal - advanceApplied).toFixed(2),
    );

    await prisma.invoice.create({
      data: {
        id: 'seed-invoice-villa-p1',
        companyId: company.id,
        customerId: villaCustomer.id,
        jobId: 'seed-job-villa',
        number: 'BM-INV-0001',
        kind: 'progressive',
        status: 'issued',
        notes: '40% progressive on material delivery',
        subtotal: progressiveSubtotal,
        vatAmount: progressiveVat,
        total: progressiveTotal,
        purchaseTotal: Number((purchaseTotal * 0.4).toFixed(2)),
        advanceApplied,
        netPayable,
        lines: {
          create: [
            {
              id: 'seed-invoice-villa-p1-line',
              description: 'Progressive 40% — Calacatta Gold supply',
              unit: 'sqm',
              qty: qty * 0.4,
              unitPrice: sellPrice,
              purchasePrice,
              lineTotal: progressiveSubtotal,
              sortOrder: 0,
            },
          ],
        },
        allocations: {
          create: [
            {
              id: 'seed-alloc-villa-p1',
              advanceId: 'seed-advance-villa',
              amount: advanceApplied,
            },
          ],
        },
      },
    });

    await prisma.ledgerEntry.createMany({
      data: [
        {
          id: 'seed-ledger-advance',
          companyId: company.id,
          customerId: villaCustomer.id,
          jobId: 'seed-job-villa',
          advanceId: 'seed-advance-villa',
          entryType: 'advance_received',
          direction: 'credit',
          amount: 8000,
          memo: 'Mobilisation advance',
        },
        {
          id: 'seed-ledger-invoice',
          companyId: company.id,
          customerId: villaCustomer.id,
          jobId: 'seed-job-villa',
          invoiceId: 'seed-invoice-villa-p1',
          entryType: 'invoice_issued',
          direction: 'debit',
          amount: progressiveTotal,
          memo: 'BM-INV-0001',
        },
      ],
    });
  }

  console.log(
    'Seeded Binhaj Marble pilot: suppliers, products, customers, villa job path',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
