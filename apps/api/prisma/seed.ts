import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Pilot login for Binhaj Marble (change after go-live). */
const PILOT_PASSWORD = process.env.SEED_OWNER_PASSWORD || 'binhaj123';

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

  const passwordHash = await bcrypt.hash(PILOT_PASSWORD, 10);

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
      passwordHash,
      companyRole: 'admin',
    },
    create: {
      companyId: company.id,
      email: 'owner@binhajmarble.ae',
      name: 'Binhaj Owner',
      passwordHash,
      companyRole: 'admin',
    },
  });

  await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company.id,
        email: 'sales@binhajmarble.ae',
      },
    },
    update: {
      name: 'Binhaj Sales',
      active: true,
      passwordHash,
      companyRole: 'member',
    },
    create: {
      companyId: company.id,
      email: 'sales@binhajmarble.ae',
      name: 'Binhaj Sales',
      passwordHash,
      companyRole: 'member',
    },
  });

  const pilotPlan = await prisma.plan.upsert({
    where: { code: 'pilot' },
    update: {
      name: 'Pilot',
      interval: 'yearly',
      priceAed: 0,
      trialDays: 365,
      maxUsers: 5,
      active: true,
    },
    create: {
      name: 'Pilot',
      code: 'pilot',
      interval: 'yearly',
      priceAed: 0,
      trialDays: 365,
      maxUsers: 5,
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

  const farExpiry = new Date();
  farExpiry.setFullYear(farExpiry.getFullYear() + 2);

  await prisma.companySubscription.upsert({
    where: { companyId: company.id },
    update: {
      planId: pilotPlan.id,
      status: 'active',
      seatsIncluded: pilotPlan.maxUsers,
      expiresAt: farExpiry,
    },
    create: {
      companyId: company.id,
      planId: pilotPlan.id,
      status: 'active',
      seatsIncluded: pilotPlan.maxUsers,
      startsAt: new Date(),
      expiresAt: farExpiry,
    },
  });

  const marbleCategory = await prisma.industryCategory.upsert({
    where: { code: 'marble' },
    update: { name: 'Marble & Stone', active: true },
    create: { code: 'marble', name: 'Marble & Stone', active: true },
  });

  const counterTopFeature = await prisma.appFeature.upsert({
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
        featureId: counterTopFeature.id,
        categoryId: marbleCategory.id,
      },
    },
    update: {},
    create: {
      featureId: counterTopFeature.id,
      categoryId: marbleCategory.id,
    },
  });

  await prisma.company.update({
    where: { id: company.id },
    data: { industryCategoryId: marbleCategory.id },
  });

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
  const platformHash = await bcrypt.hash(platformPassword, 10);

  await prisma.platformAdmin.upsert({
    where: { email: platformEmail },
    update: {
      name: 'Platform Admin',
      passwordHash: platformHash,
      active: true,
    },
    create: {
      email: platformEmail,
      name: 'Platform Admin',
      passwordHash: platformHash,
      active: true,
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

  // Reusable quotation blocks (terms / notes / bank) from pilot PDF templates.
  const lookupSeeds = [
    {
      id: 'seed-lookup-terms-standard',
      category: 'terms',
      appliesTo: 'both',
      title: 'Standard Terms & Conditions',
      body: `A) Payment:
● Payment Terms: 80% as Advance & 20% before work completion
● Payment modes: Cheque to "Binhaj Marble LLC"
● Bank Transfer: Emirates NBD · AED · IBAN AE070331234567890123456

B) Validity:
● This offer is valid for 15 days from the date of issue and subject to official confirmation.

C) Other General Terms:
● The price may vary if there are any changes or addition at final site.
● Electrical & Plumbing Works are excluded.
● Service lift must be available if material need to be shifted to upper floors.
● If the client fails to pay on time, the material at site will be returned.
● Any damage due to other contractors' negligence during execution is additional scope and quoted separately.
● The client must approve the shop drawing.
● The client will be charged 50% of the total order value in case of cancellation of confirmed orders.

E) Work execution:
● After shop drawing approval, work will be executed within 10–14 days.
● Protection of treated / surface shall be provided by the client / main contractor.
● Scaffoldings to be provided by the client/contractor unless agreed.

F) Guarantee:
● Workmanship warranty applies for 12 months from the delivery date.
● Product warranty as per the manufacturer's manual.`,
      sortOrder: 0,
    },
    {
      id: 'seed-lookup-notes-client-material',
      category: 'notes',
      appliesTo: 'counter_top',
      title: 'Client-supplied material disclaimer',
      body: '*Please note that Binhaj Marble will not bear any responsibility for material provided by the client. In the event of breakage or damage during production, the client will be required to supply additional slabs as needed.',
      sortOrder: 0,
    },
    {
      id: 'seed-lookup-bank',
      category: 'bank',
      appliesTo: 'both',
      title: 'Bank transfer details',
      body: 'Cheque to "Binhaj Marble LLC"\nBank Transfer: Emirates NBD · AED · IBAN AE070331234567890123456',
      sortOrder: 0,
    },
  ] as const;

  const specLabelSeeds = [
    { id: 'seed-lookup-spec-material', title: 'Material', body: 'By Client' },
    {
      id: 'seed-lookup-spec-scope',
      title: 'Scope of work',
      body: 'Cutting, Fabrication and Installation of Countertop',
    },
    {
      id: 'seed-lookup-spec-dimension',
      title: 'Vanity Counter Top Dimension',
      body: '110x55 CM',
    },
    { id: 'seed-lookup-spec-fascia', title: 'Fascia', body: '20 CM' },
    { id: 'seed-lookup-spec-support', title: 'Support', body: 'Included' },
    { id: 'seed-lookup-spec-sink', title: 'Customized Sink', body: '1 Nos' },
    { id: 'seed-lookup-spec-splash', title: 'Rear Splash', body: 'Excluded' },
    { id: 'seed-lookup-spec-drawer', title: 'Wooden Drawer', body: 'Excluded' },
    { id: 'seed-lookup-spec-mixer', title: 'Mixer Hole', body: 'Wall Mounted' },
    { id: 'seed-lookup-spec-edge', title: 'Edge Finish', body: '45 mm thick mitre edge' },
    { id: 'seed-lookup-spec-backsplash', title: 'Backsplash', body: 'Excluded' },
    { id: 'seed-lookup-spec-shelf', title: 'Shelf', body: 'Included' },
    { id: 'seed-lookup-spec-shelf-dim', title: 'Shelf Dimension', body: '152x60 CM' },
  ] as const;

  for (const lookup of lookupSeeds) {
    await prisma.quotationLookup.upsert({
      where: { id: lookup.id },
      update: {
        category: lookup.category,
        appliesTo: lookup.appliesTo,
        title: lookup.title,
        body: lookup.body,
        active: true,
        sortOrder: lookup.sortOrder,
      },
      create: {
        id: lookup.id,
        companyId: company.id,
        category: lookup.category,
        appliesTo: lookup.appliesTo,
        title: lookup.title,
        body: lookup.body,
        active: true,
        sortOrder: lookup.sortOrder,
      },
    });
  }

  for (const [index, spec] of specLabelSeeds.entries()) {
    await prisma.quotationLookup.upsert({
      where: { id: spec.id },
      update: {
        category: 'spec',
        appliesTo: 'counter_top',
        title: spec.title,
        body: spec.body,
        active: true,
        sortOrder: index,
      },
      create: {
        id: spec.id,
        companyId: company.id,
        category: 'spec',
        appliesTo: 'counter_top',
        title: spec.title,
        body: spec.body,
        active: true,
        sortOrder: index,
      },
    });
  }

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

  // Sample Counter Top quotation (from docs/report PDFs) — draft for demo.
  const existingCounterTop = await prisma.quotation.findUnique({
    where: { id: 'seed-quotation-counter-top-demo' },
  });

  if (!existingCounterTop) {
    const subtotal = 9500;
    const vatAmount = 475;
    const total = 9975;
    const counterTopNumber = 'BM-QT-CT-0001';

    await prisma.quotation.create({
      data: {
        id: 'seed-quotation-counter-top-demo',
        companyId: company.id,
        customerId: villaCustomer.id,
        number: counterTopNumber,
        kind: 'counter_top',
        status: 'draft',
        title: 'Guest bathroom vanity counter tops',
        contactName: 'Fatima Al Noor',
        contactPhone: '+971501234567',
        location: 'Palm Jumeirah, Dubai',
        subtotal,
        vatAmount,
        total,
        purchaseTotal: 0,
        sections: {
          create: [
            {
              id: 'seed-ct-section-1',
              productName: 'GUEST BATHROOM VANITY',
              amount: 4500,
              sortOrder: 0,
              items: {
                create: [
                  { label: 'Material', value: 'By Client', sortOrder: 0 },
                  {
                    label: 'Scope of work',
                    value: 'Cutting, Fabrication and Installation of Countertop',
                    sortOrder: 1,
                  },
                  {
                    label: 'Vanity Counter Top Dimension',
                    value: '110x55 CM',
                    sortOrder: 2,
                  },
                  { label: 'Fascia', value: '20 CM', sortOrder: 3 },
                  { label: 'Support', value: 'Included', sortOrder: 4 },
                  { label: 'Customized Sink', value: '1 Nos', sortOrder: 5 },
                  { label: 'Rear Splash', value: 'Excluded', sortOrder: 6 },
                  { label: 'Wooden Drawer', value: 'Excluded', sortOrder: 7 },
                  { label: 'Mixer Hole', value: 'Wall Mounted', sortOrder: 8 },
                ],
              },
            },
            {
              id: 'seed-ct-section-2',
              productName: 'GF GUEST BATHROOM VANITY',
              amount: 5000,
              sortOrder: 1,
              items: {
                create: [
                  { label: 'Material', value: 'Moraine', sortOrder: 0 },
                  {
                    label: 'Scope of work',
                    value: 'Cutting Fabrication and Installation of Countertop',
                    sortOrder: 1,
                  },
                  {
                    label: 'Vanity Counter Top Dimension',
                    value: '186x55 CM',
                    sortOrder: 2,
                  },
                  { label: 'Fascia', value: '20 CM', sortOrder: 3 },
                  { label: 'Support', value: 'Included', sortOrder: 4 },
                  { label: 'Customized Sink', value: '1 Nos', sortOrder: 5 },
                  { label: 'Mixer Hole', value: 'Wall Mounted', sortOrder: 6 },
                  { label: 'Rear Splash', value: 'Excluded', sortOrder: 7 },
                  { label: 'Wooden Drawer', value: 'Excluded', sortOrder: 8 },
                ],
              },
            },
          ],
        },
        lookupLinks: {
          create: [
            { lookupId: 'seed-lookup-terms-standard' },
            { lookupId: 'seed-lookup-notes-client-material' },
            { lookupId: 'seed-lookup-bank' },
          ],
        },
      },
    });
  }

  console.log(
    'Seeded Binhaj Marble pilot: plans, subscription, industry features, platform admin, suppliers, products, customers, lookups, villa job path, counter-top demo',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
