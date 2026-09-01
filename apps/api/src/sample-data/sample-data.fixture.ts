import type { Prisma } from '@prisma/client';

export const TEMPLATE_KEY = 'enterprise-hub-trial';
export const TEMPLATE_VERSION = 3;

export type SampleDataMetadata = {
  hr: {
    employeeIds: string[];
    departmentIds: string[];
    designationIds: string[];
    locationIds: string[];
    leaveTypeIds: string[];
    payrollPeriodIds: string[];
  };
};

export function parseSampleMetadata(value: unknown): SampleDataMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const hr = (value as SampleDataMetadata).hr;
  if (!hr || !Array.isArray(hr.employeeIds)) return null;
  return value as SampleDataMetadata;
}

export const SUPPLIERS = [
  ['Alpine Stone Trading', 'Dubai', 'orders@alpinestone.example'],
  ['Carrara Select Imports', 'Jebel Ali', 'sales@carraraselect.example'],
  ['Oman Beige Quarries', 'Nizwa, Oman', 'sales@omanbeige.example'],
  ['Gulf Surface Materials', 'Abu Dhabi', 'trade@gulfsurface.example'],
  ['Levant Marble House', 'Sharjah', 'hello@levantmarble.example'],
  ['Atlas Ceramic Supply', 'Ajman', 'orders@atlasceramic.example'],
  ['Northern Granite Works', 'Ras Al Khaimah', 'sales@northerngranite.example'],
  ['Emirates Stone Logistics', 'Dubai', 'dispatch@eslogistics.example'],
  ['Mediterranean Slab Co.', 'Fujairah', 'sales@medslab.example'],
  ['Pearl Edge Fabrication', 'Dubai', 'projects@pearledge.example'],
  ['Urban Tile Partners', 'Abu Dhabi', 'orders@urbantile.example'],
  ['Desert Quarry Collective', 'Al Ain', 'trade@desertquarry.example'],
] as const;

export const PRODUCTS = [
  ['Calacatta Gold', 'CAL-GOLD', 420, 780],
  ['Emperador Dark', 'EMP-DARK', 180, 340],
  ['Oman Beige', 'OMN-BEIGE', 95, 210],
  ['Statuario Venato', 'STAT-VEN', 510, 920],
  ['Bianco Carrara', 'BIAN-CAR', 220, 430],
  ['Nero Marquina', 'NERO-MAR', 260, 520],
  ['Crema Marfil', 'CREMA-MAR', 145, 300],
  ['Travertine Classic', 'TRAV-CLS', 125, 260],
  ['Silver Roots Granite', 'SIL-GRAN', 190, 390],
  ['Absolute Black Granite', 'ABS-BLK', 240, 480],
  ['Taj Mahal Quartzite', 'TAJ-QUA', 620, 1150],
  ['Arabescato White', 'ARAB-WHT', 460, 860],
  ['Moca Cream Limestone', 'MOCA-CRM', 135, 285],
  ['Verde Guatemala', 'VERDE-GUA', 330, 640],
  ['Pietra Grey', 'PIET-GRY', 210, 440],
  ['Botticino Beige', 'BOTT-BEI', 160, 325],
  ['Blue Roma Quartz', 'BLUE-ROM', 390, 720],
  ['Onyx Honey', 'ONYX-HNY', 740, 1400],
  ['Concrete Grey Porcelain', 'PORC-GRY', 75, 165],
  ['Sandstone Warm', 'SAND-WRM', 110, 230],
  ['Luna Pearl', 'LUNA-PRL', 280, 540],
  ['Misty White Quartz', 'MIST-WHT', 310, 590],
  ['Graphite Ceramic', 'GRAPH-CER', 85, 185],
  ['Ivory Limestone', 'IVRY-LIM', 130, 275],
] as const;

export const CUSTOMERS = [
  ['Al Noor Villa Fit-out', 'Fatima Al Noor', 'Dubai'],
  ['Bayview Hotel Lobby', 'Procurement Desk', 'Abu Dhabi'],
  ['Crescent Residence', 'Omar Khalid', 'Dubai'],
  ['Harbour View Offices', 'Mariam Saeed', 'Sharjah'],
  ['Palm Court Townhouses', 'Rami Haddad', 'Dubai'],
  ['Safa Boutique Hotel', 'Lina Mansour', 'Dubai'],
  ['Jumeirah Garden Villa', 'Hassan Ali', 'Dubai'],
  ['Meadows Community Centre', 'Project Office', 'Dubai'],
  ['Al Raha Retail Centre', 'Nadia Rahman', 'Abu Dhabi'],
  ['Marina Restaurant Group', 'Yousef Salem', 'Dubai'],
  ['Al Zahia Family Home', 'Sara Hamdan', 'Sharjah'],
  ['Dune Heights Development', 'Projects Team', 'Al Ain'],
  ['Oasis Medical Centre', 'Facilities Team', 'Abu Dhabi'],
  ['Creekside Penthouse', 'Bilal Nasser', 'Dubai'],
  ['Heritage Courtyard Homes', 'Aisha Karim', 'Ajman'],
  ['Summit Commercial Tower', 'Commercial Projects', 'Dubai'],
  ['Bluewater Beach House', 'Noura Faris', 'Fujairah'],
  ['Wadi Stone Residence', 'Khaled Noor', 'Ras Al Khaimah'],
] as const;

export const HR_EMPLOYEES = [
  ['Ahmed', 'Hassan', 'Operations', 'Site Supervisor'],
  ['Fatima', 'Ali', 'Sales', 'Sales Executive'],
  ['Omar', 'Khalid', 'Workshop', 'Fabricator'],
  ['Mariam', 'Saeed', 'Operations', 'Project Coordinator'],
  ['Rami', 'Haddad', 'Workshop', 'Polishing Lead'],
  ['Lina', 'Mansour', 'Sales', 'Estimator'],
  ['Hassan', 'Yousef', 'Operations', 'Delivery Driver'],
  ['Nadia', 'Rahman', 'Workshop', 'CNC Operator'],
  ['Sara', 'Hamdan', 'Sales', 'Account Manager'],
  ['Bilal', 'Nasser', 'Operations', 'Warehouse Keeper'],
  ['Aisha', 'Karim', 'Workshop', 'Quality Inspector'],
  ['Khaled', 'Noor', 'Operations', 'HR Assistant'],
] as const;

function round(value: number) {
  return Number(value.toFixed(2));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function ids(rows: Array<{ id: string }>) {
  return rows.map((row) => row.id);
}

type ProductRow = {
  id: string;
  sampleKey: string | null;
  purchasePrice: number;
  sellPrice: number;
  name: string;
  unit: string;
};

export async function createSampleFixture(
  tx: Prisma.TransactionClient,
  companyId: string,
  sampleSetId: string,
): Promise<SampleDataMetadata> {
  await tx.supplier.createMany({
    data: SUPPLIERS.map(([name, address, email], index) => ({
      companyId,
      sampleSetId,
      sampleKey: `supplier-${index + 1}`,
      name,
      contact: 'Procurement team',
      phone: `+97150100${String(index + 1).padStart(4, '0')}`,
      email,
      address,
      notes: 'Active supplier for stone and surface materials.',
      active: true,
    })),
  });

  const supplierRows = await tx.supplier.findMany({
    where: { companyId, sampleSetId },
    select: { id: true, sampleKey: true },
    orderBy: { createdAt: 'asc' },
  });
  const supplierByKey = new Map(
    supplierRows.map((row) => [row.sampleKey ?? '', row.id]),
  );

  await tx.product.createMany({
    data: PRODUCTS.map(([name, sku, purchasePrice, sellPrice], index) => ({
      companyId,
      sampleSetId,
      sampleKey: `product-${index + 1}`,
      supplierId: supplierByKey.get(
        `supplier-${(index % SUPPLIERS.length) + 1}`,
      ),
      name,
      sku,
      unit: 'sqm',
      purchasePrice,
      sellPrice,
      description: `Premium ${name.toLowerCase()} for residential and commercial fit-out.`,
      active: true,
    })),
  });

  const productRows = await tx.product.findMany({
    where: { companyId, sampleSetId },
    select: {
      id: true,
      sampleKey: true,
      purchasePrice: true,
      sellPrice: true,
      name: true,
      unit: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const productByKey = new Map(
    productRows.map((row) => [row.sampleKey ?? '', row as ProductRow]),
  );

  await tx.customer.createMany({
    data: CUSTOMERS.map(([name, contact, city], index) => ({
      companyId,
      sampleSetId,
      sampleKey: `customer-${index + 1}`,
      name,
      contact,
      phone: `+97152110${String(index + 1).padStart(4, '0')}`,
      email: `accounts${index + 1}@example.com`,
      address: `${city}, United Arab Emirates`,
      trn:
        index % 3 === 0
          ? `100000000000${String(index + 1).padStart(3, '0')}`
          : null,
      notes: 'Active customer account.',
      active: true,
    })),
  });

  const customerRows = await tx.customer.findMany({
    where: { companyId, sampleSetId },
    select: { id: true, sampleKey: true },
    orderBy: { createdAt: 'asc' },
  });
  const customerByKey = new Map(
    customerRows.map((row) => [row.sampleKey ?? '', row.id]),
  );

  await tx.quotationLookup.createMany({
    data: [
      ['lookup-terms', 'terms', 'Standard payment terms', '80% advance and 20% before completion.'],
      ['lookup-bank', 'bank', 'Bank transfer details', 'Emirates NBD current account — details shared on approved quotations.'],
      ['lookup-note', 'notes', 'Project notes', 'Site measurement and shop drawing approval included.'],
      ['lookup-warranty', 'notes', 'Warranty', 'Workmanship warranty applies for twelve months.'],
      ['lookup-counter', 'spec', 'Countertop scope', 'Cutting, fabrication, edge finishing and installation.'],
      ['lookup-delivery', 'terms', 'Delivery terms', 'Material delivery is coordinated after approval.'],
      ['lookup-edge', 'spec', 'Edge profile', 'Half-bullnose edge profile included unless noted.'],
      ['lookup-sealing', 'notes', 'Sealing', 'Initial sealing included for natural stone surfaces.'],
    ].map(([sampleKey, category, title, body], index) => ({
      companyId,
      sampleSetId,
      sampleKey,
      category,
      appliesTo: category === 'spec' ? 'counter_top' : 'both',
      title,
      body,
      active: true,
      sortOrder: index,
    })),
  });

  const lookupRows = await tx.quotationLookup.findMany({
    where: { companyId, sampleSetId },
    select: { id: true },
  });

  const now = new Date();
  const approvedQuotes: Array<{
    id: string;
    customerId: string;
    productId: string;
    index: number;
  }> = [];

  for (let index = 0; index < 18; index += 1) {
    const customerId = customerByKey.get(`customer-${index + 1}`);
    const product = productByKey.get(`product-${(index % PRODUCTS.length) + 1}`);
    if (!customerId || !product) continue;
    const status =
      index < 13 ? 'approved' : index < 16 ? 'draft' : 'cancelled';
    const qty = 12 + index * 2;
    const subtotal = round(qty * product.sellPrice);
    const vatAmount = round(subtotal * 0.05);
    const quote = await tx.quotation.create({
      data: {
        companyId,
        sampleSetId,
        sampleKey: `quotation-${index + 1}`,
        customerId,
        number: `QT-${String(index + 1).padStart(4, '0')}`,
        kind: index % 4 === 0 ? 'counter_top' : 'general',
        status,
        title: `${CUSTOMERS[index][0]} stone package`,
        notes: 'Quotation prepared after site measurement and material selection.',
        contactName: CUSTOMERS[index][1],
        contactPhone: `+97152110${String(index + 1).padStart(4, '0')}`,
        location: `${CUSTOMERS[index][2]}, UAE`,
        validUntil: addDays(now, 30),
        subtotal,
        vatAmount,
        total: round(subtotal + vatAmount),
        purchaseTotal: round(qty * product.purchasePrice),
        approvedAt: status === 'approved' ? addDays(now, -index) : null,
        cancelledAt: status === 'cancelled' ? addDays(now, -2) : null,
        lines: {
          create: [
            {
              productId: product.id,
              description: product.name,
              unit: product.unit,
              qty,
              purchasePrice: product.purchasePrice,
              sellPrice: product.sellPrice,
              lineTotal: subtotal,
              sortOrder: 0,
            },
          ],
        },
        lookupLinks: {
          create: lookupRows
            .slice(0, (index % 3) + 2)
            .map((row) => ({ lookupId: row.id })),
        },
      },
    });
    if (status === 'approved') {
      approvedQuotes.push({
        id: quote.id,
        customerId,
        productId: product.id,
        index,
      });
    }
  }

  for (const [jobIndex, quote] of approvedQuotes.entries()) {
    const product = productByKey.get(
      `product-${(quote.index % PRODUCTS.length) + 1}`,
    );
    if (!product) continue;
    const qty = 12 + quote.index * 2;
    const subtotal = round(qty * product.sellPrice);
    const vat = round(subtotal * 0.05);
    const total = round(subtotal + vat);
    const job = await tx.job.create({
      data: {
        companyId,
        sampleSetId,
        sampleKey: `job-${jobIndex + 1}`,
        customerId: quote.customerId,
        quotationId: quote.id,
        number: `JOB-${String(jobIndex + 1).padStart(4, '0')}`,
        status:
          jobIndex < 9 ? 'open' : jobIndex < 12 ? 'completed' : 'closed',
        title: `Installation project ${jobIndex + 1}`,
        jobValue: total,
        jobNet: subtotal,
        purchaseTotal: round(qty * product.purchasePrice),
        completedAt: jobIndex >= 9 ? addDays(now, -jobIndex) : null,
        closedAt: jobIndex >= 12 ? addDays(now, -jobIndex) : null,
      },
    });

    const advanceAmount = round(1500 + jobIndex * 375);
    const invoiceSubtotal = round(subtotal * (jobIndex % 3 === 0 ? 0.4 : 0.65));
    const invoiceVat = round(invoiceSubtotal * 0.05);
    const invoiceTotal = round(invoiceSubtotal + invoiceVat);
    const advance = await tx.advancePayment.create({
      data: {
        companyId,
        sampleSetId,
        sampleKey: `advance-${jobIndex + 1}`,
        customerId: quote.customerId,
        jobId: job.id,
        number: `ADV-${String(jobIndex + 1).padStart(4, '0')}`,
        amount: advanceAmount,
        allocatedAmount: 0,
        method: jobIndex % 2 === 0 ? 'bank_transfer' : 'cash',
        reference: `TRX-${String(jobIndex + 1).padStart(4, '0')}`,
        receivedAt: addDays(now, -(jobIndex + 4)),
        notes: 'Generic trial advance receipt',
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        companyId,
        sampleSetId,
        sampleKey: `invoice-${jobIndex + 1}`,
        customerId: quote.customerId,
        jobId: job.id,
        number: `INV-${String(jobIndex + 1).padStart(4, '0')}`,
        kind:
          jobIndex % 3 === 0
            ? 'progressive'
            : jobIndex % 3 === 1
              ? 'custom'
              : 'final',
        status: jobIndex === 11 ? 'cancelled' : 'issued',
        issueDate: addDays(now, -(jobIndex + 2)),
        dueDate: addDays(now, 14 - jobIndex),
        notes: 'Generic trial invoice for reporting and PDF testing.',
        subtotal: invoiceSubtotal,
        vatAmount: invoiceVat,
        total: invoiceTotal,
        purchaseTotal: round(
          qty * product.purchasePrice * (jobIndex % 3 === 0 ? 0.4 : 0.65),
        ),
        advanceApplied: round(Math.min(advanceAmount, invoiceTotal * 0.35)),
        netPayable: round(
          invoiceTotal - Math.min(advanceAmount, invoiceTotal * 0.35),
        ),
        lines: {
          create: [
            {
              description: product.name,
              unit: product.unit,
              qty: qty * (jobIndex % 3 === 0 ? 0.4 : 0.65),
              unitPrice: product.sellPrice,
              purchasePrice: product.purchasePrice,
              lineTotal: invoiceSubtotal,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    const allocated = round(Math.min(advanceAmount, invoiceTotal * 0.35));
    await tx.invoiceAdvanceAllocation.create({
      data: { invoiceId: invoice.id, advanceId: advance.id, amount: allocated },
    });
    await tx.advancePayment.update({
      where: { id: advance.id },
      data: { allocatedAmount: allocated },
    });
    await tx.ledgerEntry.createMany({
      data: [
        {
          companyId,
          customerId: quote.customerId,
          jobId: job.id,
          advanceId: advance.id,
          entryType: 'advance_received',
          direction: 'credit',
          amount: advanceAmount,
          occurredAt: advance.receivedAt,
          memo: advance.reference,
        },
        {
          companyId,
          customerId: quote.customerId,
          jobId: job.id,
          invoiceId: invoice.id,
          entryType: 'invoice_issued',
          direction: 'debit',
          amount: invoiceTotal,
          occurredAt: invoice.issueDate,
          memo: invoice.number,
        },
      ],
    });

    if (jobIndex < 7) {
      const extraSubtotal = round(subtotal * 0.2);
      const extraVat = round(extraSubtotal * 0.05);
      await tx.invoice.create({
        data: {
          companyId,
          sampleSetId,
          sampleKey: `invoice-extra-${jobIndex + 1}`,
          customerId: quote.customerId,
          jobId: job.id,
          number: `INV-${String(jobIndex + 14).padStart(4, '0')}`,
          kind: 'progressive',
          status: 'issued',
          issueDate: addDays(now, -(jobIndex + 1)),
          dueDate: addDays(now, 21 - jobIndex),
          notes: 'Progressive billing milestone.',
          subtotal: extraSubtotal,
          vatAmount: extraVat,
          total: round(extraSubtotal + extraVat),
          purchaseTotal: round(qty * product.purchasePrice * 0.2),
          netPayable: round(extraSubtotal + extraVat),
          lines: {
            create: [
              {
                description: `${product.name} — progress claim`,
                unit: product.unit,
                qty: qty * 0.2,
                unitPrice: product.sellPrice,
                purchasePrice: product.purchasePrice,
                lineTotal: extraSubtotal,
                sortOrder: 0,
              },
            ],
          },
        },
      });
    }
  }

  for (let index = 0; index < 5; index += 1) {
    const customerId = customerByKey.get(`customer-${index + 14}`);
    if (!customerId) continue;
    await tx.advancePayment.create({
      data: {
        companyId,
        sampleSetId,
        sampleKey: `advance-unalloc-${index + 1}`,
        customerId,
        number: `ADV-${String(index + 20).padStart(4, '0')}`,
        amount: 900 + index * 275,
        allocatedAmount: 0,
        method: 'bank_transfer',
        reference: `UNALLOC-${index + 1}`,
        receivedAt: addDays(now, -(index + 1)),
        notes: 'Advance received and held on account.',
      },
    });
  }

  await createPurchasingFixture(
    tx,
    companyId,
    sampleSetId,
    supplierByKey,
    productByKey,
    now,
  );
  const hr = await createHrFixture(tx, companyId, now);
  return { hr };
}

async function createPurchasingFixture(
  tx: Prisma.TransactionClient,
  companyId: string,
  sampleSetId: string,
  supplierByKey: Map<string, string>,
  productByKey: Map<string, ProductRow>,
  now: Date,
) {
  const lpoStatuses = [
    'draft',
    'approved',
    'sent',
    'sent',
    'closed',
    'cancelled',
  ] as const;

  for (let index = 0; index < 14; index += 1) {
    const supplierId = supplierByKey.get(
      `supplier-${(index % SUPPLIERS.length) + 1}`,
    );
    const product = productByKey.get(`product-${(index % PRODUCTS.length) + 1}`);
    if (!supplierId || !product) continue;

    const qty = 8 + index * 1.5;
    const lineTotal = round(qty * product.purchasePrice);
    const inputVat = round(lineTotal * 0.05);
    const total = round(lineTotal + inputVat);
    const status = lpoStatuses[index % lpoStatuses.length];

    const lpo = await tx.lpo.create({
      data: {
        companyId,
        supplierId,
        number: `LPO-${String(index + 1).padStart(4, '0')}`,
        status,
        requestedDeliveryDate: addDays(now, 7 + index),
        notes: 'Purchase order issued after supplier confirmation.',
        subtotal: lineTotal,
        inputVat,
        total,
        approvedAt: ['approved', 'sent', 'closed'].includes(status)
          ? addDays(now, -(index + 3))
          : null,
        sentAt: ['sent', 'closed'].includes(status)
          ? addDays(now, -(index + 2))
          : null,
        closedAt: status === 'closed' ? addDays(now, -1) : null,
        cancelledAt: status === 'cancelled' ? addDays(now, -1) : null,
        lines: {
          create: [
            {
              companyId,
              productId: product.id,
              productName: product.name,
              unit: product.unit,
              orderedQty: qty,
              receivedQty: status === 'closed' ? qty : status === 'sent' ? qty * 0.6 : 0,
              invoicedQty: status === 'closed' ? qty : 0,
              unitCost: product.purchasePrice,
              vatRate: 0.05,
              lineTotal,
              sortOrder: 0,
            },
          ],
        },
      },
      include: { lines: true },
    });

    if (status === 'sent' || status === 'closed') {
      const receivedQty = status === 'closed' ? qty : qty * 0.6;
      const receipt = await tx.lpoReceipt.create({
        data: {
          companyId,
          lpoId: lpo.id,
          number: `RCV-${String(index + 1).padStart(4, '0')}`,
          receiptDate: addDays(now, -(index + 1)),
          note: 'Goods received and checked against the purchase order.',
        },
      });
      await tx.lpoReceiptLine.create({
        data: {
          companyId,
          receiptId: receipt.id,
          lpoLineId: lpo.lines[0]!.id,
          receivedQty,
        },
      });
    }

    if (index >= 2 && index !== 13) {
      const invSubtotal = lineTotal;
      const invVat = inputVat;
      const invTotal = total;
      const piStatus =
        index % 4 === 0
          ? 'draft'
          : index % 4 === 1
            ? 'posted'
            : index % 4 === 2
              ? 'partially_paid'
              : 'paid';
      const paidAmount =
        piStatus === 'paid'
          ? invTotal
          : piStatus === 'partially_paid'
            ? round(invTotal * 0.5)
            : 0;
      const balance = round(invTotal - paidAmount);

      const purchaseInvoice = await tx.purchaseInvoice.create({
        data: {
          companyId,
          supplierId,
          lpoId: lpo.id,
          number: `PINV-${String(index + 1).padStart(4, '0')}`,
          supplierInvoiceNumber: `SUP-REF-${String(index + 1).padStart(4, '0')}`,
          issueDate: addDays(now, -(index + 2)),
          dueDate: addDays(now, 20 - index),
          status: piStatus === 'draft' ? 'draft' : piStatus,
          subtotal: invSubtotal,
          inputVat: invVat,
          total: invTotal,
          paidAmount,
          balance: piStatus === 'draft' ? invTotal : balance,
          postedAt: piStatus !== 'draft' ? addDays(now, -(index + 1)) : null,
          lines: {
            create: [
              {
                companyId,
                lpoLineId: lpo.lines[0]!.id,
                productId: product.id,
                productName: product.name,
                unit: product.unit,
                qty,
                unitCost: product.purchasePrice,
                vatRate: 0.05,
                lineTotal: invSubtotal,
              },
            ],
          },
        },
      });

      if (piStatus !== 'draft') {
        await tx.supplierLedgerEntry.create({
          data: {
            companyId,
            supplierId,
            purchaseInvoiceId: purchaseInvoice.id,
            direction: 'credit',
            amount: invTotal,
            description: `Purchase invoice ${purchaseInvoice.number}`,
            occurredAt: purchaseInvoice.issueDate,
          },
        });
        await tx.supplierPriceHistory.create({
          data: {
            companyId,
            supplierId,
            productId: product.id,
            productName: product.name,
            unitCost: product.purchasePrice,
            currency: 'AED',
            sourceType: 'purchase_invoice',
            sourceId: purchaseInvoice.id,
            effectiveAt: purchaseInvoice.issueDate,
          },
        });
      }

      if (paidAmount > 0) {
        const payment = await tx.supplierPayment.create({
          data: {
            companyId,
            supplierId,
            number: `SPAY-${String(index + 1).padStart(4, '0')}`,
            paidAt: addDays(now, -index),
            amount: paidAmount,
            method: index % 2 === 0 ? 'bank_transfer' : 'cheque',
            reference: `PAY-${String(index + 1).padStart(4, '0')}`,
            unappliedAmount: 0,
            notes: 'Payment allocated to supplier invoice.',
          },
        });
        await tx.supplierPaymentAllocation.create({
          data: {
            companyId,
            paymentId: payment.id,
            purchaseInvoiceId: purchaseInvoice.id,
            amount: paidAmount,
          },
        });
        await tx.supplierLedgerEntry.create({
          data: {
            companyId,
            supplierId,
            paymentId: payment.id,
            direction: 'debit',
            amount: paidAmount,
            description: `Supplier payment ${payment.number}`,
            occurredAt: payment.paidAt,
          },
        });
      }
    }
  }

  if (supplierByKey.get('supplier-1')) {
    const supplierId = supplierByKey.get('supplier-1')!;
    const payment = await tx.supplierPayment.create({
      data: {
        companyId,
        supplierId,
        number: `SPAY-ADV-0001`,
        paidAt: addDays(now, -3),
        amount: 2500,
        method: 'bank_transfer',
        reference: `ADV-PAY-0001`,
        unappliedAmount: 2500,
        notes: 'Unapplied supplier advance.',
      },
    });
    await tx.supplierLedgerEntry.create({
      data: {
        companyId,
        supplierId,
        paymentId: payment.id,
        direction: 'debit',
        amount: payment.amount,
        description: `Supplier payment ${payment.number} including supplier advance`,
        occurredAt: payment.paidAt,
      },
    });
  }

  void sampleSetId;
}

async function createHrFixture(
  tx: Prisma.TransactionClient,
  companyId: string,
  now: Date,
): Promise<SampleDataMetadata['hr']> {
  const ops = await tx.hRDepartment.create({
    data: { companyId, name: 'Operations', active: true },
  });
  const sales = await tx.hRDepartment.create({
    data: { companyId, name: 'Sales', active: true },
  });
  const workshop = await tx.hRDepartment.create({
    data: { companyId, name: 'Workshop', active: true },
  });
  const departmentIds = [ops.id, sales.id, workshop.id];

  const deptByName = new Map([
    ['Operations', ops.id],
    ['Sales', sales.id],
    ['Workshop', workshop.id],
  ]);

  const designationNames = [
    'Site Supervisor',
    'Sales Executive',
    'Fabricator',
    'Project Coordinator',
    'Estimator',
    'Account Manager',
  ];
  const designations = await Promise.all(
    designationNames.map((name) =>
      tx.hRDesignation.create({
        data: { companyId, name, active: true },
      }),
    ),
  );
  const designationIds = designations.map((row) => row.id);
  const desigByLabel = new Map(
    designationNames.map((name, index) => [name, designations[index]!.id]),
  );

  await tx.hRWorkLocation.createMany({
    data: [
      { companyId, name: 'Dubai Workshop', active: true },
      { companyId, name: 'Abu Dhabi Office', active: true },
    ],
  });
  const locations = await tx.hRWorkLocation.findMany({
    where: { companyId, name: { in: ['Dubai Workshop', 'Abu Dhabi Office'] } },
    select: { id: true },
  });
  const locationIds = locations.map((row) => row.id);

  const annualLeave = await tx.hRLeaveType.create({
    data: { companyId, name: 'Annual leave', code: 'AL', paid: true, active: true },
  });
  const sickLeave = await tx.hRLeaveType.create({
    data: { companyId, name: 'Sick leave', code: 'SL', paid: true, active: true },
  });
  const leaveTypeIds = [annualLeave.id, sickLeave.id];

  const employeeIds: string[] = [];
  for (const [index, row] of HR_EMPLOYEES.entries()) {
    const [firstName, lastName, dept, role] = row;
    const employee = await tx.hREmployee.create({
      data: {
        companyId,
        employeeNumber: `EMP-${String(index + 1).padStart(4, '0')}`,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        phone: `+97155000${String(index + 1).padStart(4, '0')}`,
        nationality: 'United Arab Emirates',
        employmentType: 'full_time',
        status: index === 11 ? 'inactive' : 'active',
        departmentId: deptByName.get(dept),
        designationId: desigByLabel.get(role),
        joiningDate: addDays(now, -(180 + index * 14)),
        emiratesIdExpiry: addDays(now, 120 + index * 10),
        passportExpiry: addDays(now, 300 + index * 5),
        visaExpiry: addDays(now, 90 + index * 8),
      },
    });
    employeeIds.push(employee.id);

    await tx.hRLeaveBalance.create({
      data: {
        companyId,
        employeeId: employee.id,
        leaveTypeId: annualLeave.id,
        year: now.getUTCFullYear(),
        entitled: 30,
        used: index % 4,
        carried: 0,
      },
    });

    await tx.hRAttendance.create({
      data: {
        companyId,
        employeeId: employee.id,
        checkInAt: addDays(now, -(index + 1)),
        checkOutAt: addDays(now, -(index + 1)),
        capturedAt: addDays(now, -(index + 1)),
        status: 'present',
      },
    });

    if (index % 3 === 0) {
      await tx.hRLeaveRequest.create({
        data: {
          companyId,
          employeeId: employee.id,
          leaveTypeId: index % 2 === 0 ? annualLeave.id : sickLeave.id,
          startDate: addDays(now, 5 + index),
          endDate: addDays(now, 7 + index),
          days: 3,
          reason: 'Personal leave request.',
          status: index % 6 === 0 ? 'pending' : index % 6 === 3 ? 'rejected' : 'approved',
        },
      });
    }
  }

  const payroll = await tx.hRPayrollPeriod.create({
    data: {
      companyId,
      name: `${now.toLocaleString('en', { month: 'long', year: 'numeric' })} Payroll`,
      startDate: addDays(now, -30),
      endDate: addDays(now, -1),
      status: 'calculated',
      totalGross: round(employeeIds.length * 6500),
      totalDeductions: round(employeeIds.length * 150),
      totalNet: round(employeeIds.length * 6350),
    },
  });
  const payrollPeriodIds = [payroll.id];

  for (const employeeId of employeeIds) {
    await tx.hRPayrollEntry.create({
      data: {
        companyId,
        periodId: payroll.id,
        employeeId,
        basicSalary: 5000,
        allowances: 1500,
        deductions: 150,
        grossAmount: 6500,
        netAmount: 6350,
      },
    });
  }

  return {
    employeeIds,
    departmentIds,
    designationIds,
    locationIds,
    leaveTypeIds,
    payrollPeriodIds,
  };
}

export async function collectSampleRelated(
  tx: Prisma.TransactionClient,
  companyId: string,
  sampleSetId: string,
) {
  const [suppliers, products, customers, sampleQuotes, sampleJobs, sampleInvoices, sampleAdvances, lookups] =
    await Promise.all([
      tx.supplier.findMany({ where: { companyId, sampleSetId }, select: { id: true } }),
      tx.product.findMany({ where: { companyId, sampleSetId }, select: { id: true } }),
      tx.customer.findMany({ where: { companyId, sampleSetId }, select: { id: true } }),
      tx.quotation.findMany({ where: { companyId, sampleSetId }, select: { id: true } }),
      tx.job.findMany({ where: { companyId, sampleSetId }, select: { id: true } }),
      tx.invoice.findMany({ where: { companyId, sampleSetId }, select: { id: true } }),
      tx.advancePayment.findMany({ where: { companyId, sampleSetId }, select: { id: true } }),
      tx.quotationLookup.findMany({ where: { companyId, sampleSetId }, select: { id: true } }),
    ]);

  const supplierIds = ids(suppliers);
  const productIds = ids(products);
  const customerIds = ids(customers);
  const quoteIds = new Set(ids(sampleQuotes));
  const jobIds = new Set(ids(sampleJobs));
  const invoiceIds = new Set(ids(sampleInvoices));
  const advanceIds = new Set(ids(sampleAdvances));
  const lookupIds = ids(lookups);

  const [quotes, jobs, invoices, advances] = await Promise.all([
    tx.quotation.findMany({
      where: { companyId },
      select: {
        id: true,
        customerId: true,
        lines: { select: { productId: true } },
        sections: { select: { productId: true } },
      },
    }),
    tx.job.findMany({
      where: { companyId },
      select: { id: true, customerId: true, quotationId: true },
    }),
    tx.invoice.findMany({
      where: { companyId },
      select: { id: true, customerId: true, jobId: true },
    }),
    tx.advancePayment.findMany({
      where: { companyId },
      select: { id: true, customerId: true, jobId: true },
    }),
  ]);

  for (const quote of quotes) {
    if (
      customerIds.includes(quote.customerId) ||
      quote.lines.some(
        (line) => line.productId && productIds.includes(line.productId),
      ) ||
      quote.sections.some(
        (section) => section.productId && productIds.includes(section.productId),
      )
    ) {
      quoteIds.add(quote.id);
    }
  }
  for (const job of jobs) {
    if (customerIds.includes(job.customerId) || quoteIds.has(job.quotationId)) {
      jobIds.add(job.id);
    }
  }
  for (const invoice of invoices) {
    if (
      customerIds.includes(invoice.customerId) ||
      (invoice.jobId && jobIds.has(invoice.jobId))
    ) {
      invoiceIds.add(invoice.id);
    }
  }
  for (const advance of advances) {
    if (
      customerIds.includes(advance.customerId) ||
      (advance.jobId && jobIds.has(advance.jobId))
    ) {
      advanceIds.add(advance.id);
    }
  }

  const lpos = supplierIds.length
    ? await tx.lpo.findMany({
        where: { companyId, supplierId: { in: supplierIds } },
        select: { id: true },
      })
    : [];
  const lpoIds = ids(lpos);

  const purchaseInvoices = supplierIds.length
    ? await tx.purchaseInvoice.findMany({
        where: {
          companyId,
          OR: [
            { supplierId: { in: supplierIds } },
            ...(lpoIds.length ? [{ lpoId: { in: lpoIds } }] : []),
          ],
        },
        select: { id: true },
      })
    : [];
  const purchaseInvoiceIds = ids(purchaseInvoices);

  const supplierPayments = supplierIds.length
    ? await tx.supplierPayment.findMany({
        where: { companyId, supplierId: { in: supplierIds } },
        select: { id: true },
      })
    : [];
  const supplierPaymentIds = ids(supplierPayments);

  const set = await tx.sampleDataSet.findUnique({
    where: { id: sampleSetId },
    select: { metadata: true, templateVersion: true },
  });
  const metadata = parseSampleMetadata(set?.metadata);
  let hrEmployeeIds = metadata?.hr.employeeIds ?? [];
  const hrDepartmentIds = metadata?.hr.departmentIds ?? [];
  const hrDesignationIds = metadata?.hr.designationIds ?? [];
  const hrLocationIds = metadata?.hr.locationIds ?? [];
  const hrLeaveTypeIds = metadata?.hr.leaveTypeIds ?? [];
  const hrPayrollPeriodIds = metadata?.hr.payrollPeriodIds ?? [];

  // Backward compatibility for template v2 records loaded before metadata existed.
  if (!metadata && set?.templateVersion && set.templateVersion < 3) {
    const legacyEmployees = await tx.hREmployee.findMany({
      where: { companyId, employeeNumber: { startsWith: 'SAMPLE-EMP-' } },
      select: { id: true },
    });
    hrEmployeeIds.push(...legacyEmployees.map((row) => row.id));
  }

  return {
    supplierIds,
    productIds,
    customerIds,
    quoteIds: [...quoteIds],
    jobIds: [...jobIds],
    invoiceIds: [...invoiceIds],
    advanceIds: [...advanceIds],
    lookupIds,
    lpoIds,
    purchaseInvoiceIds,
    supplierPaymentIds,
    hrEmployeeIds,
    hrDepartmentIds,
    hrDesignationIds,
    hrLocationIds,
    hrLeaveTypeIds,
    hrPayrollPeriodIds,
  };
}

export async function deleteSampleRelated(
  tx: Prisma.TransactionClient,
  companyId: string,
  related: Awaited<ReturnType<typeof collectSampleRelated>>,
) {
  const entityIds = [
    ...related.supplierIds,
    ...related.productIds,
    ...related.customerIds,
    ...related.quoteIds,
    ...related.jobIds,
    ...related.invoiceIds,
    ...related.advanceIds,
    ...related.lookupIds,
    ...related.lpoIds,
    ...related.purchaseInvoiceIds,
    ...related.supplierPaymentIds,
    ...related.hrEmployeeIds,
  ];

  if (entityIds.length) {
    await tx.auditLog.deleteMany({
      where: { companyId, entityId: { in: entityIds } },
    });
  }

  await tx.ledgerEntry.deleteMany({
    where: {
      companyId,
      OR: [
        { customerId: { in: related.customerIds } },
        { jobId: { in: related.jobIds } },
        { invoiceId: { in: related.invoiceIds } },
        { advanceId: { in: related.advanceIds } },
      ],
    },
  });

  await tx.invoiceAdvanceAllocation.deleteMany({
    where: {
      OR: [
        { invoiceId: { in: related.invoiceIds } },
        { advanceId: { in: related.advanceIds } },
      ],
    },
  });

  await tx.supplierPaymentAllocation.deleteMany({
    where: {
      OR: [
        { paymentId: { in: related.supplierPaymentIds } },
        { purchaseInvoiceId: { in: related.purchaseInvoiceIds } },
      ],
    },
  });

  await tx.supplierLedgerEntry.deleteMany({
    where: {
      companyId,
      OR: [
        { supplierId: { in: related.supplierIds } },
        { purchaseInvoiceId: { in: related.purchaseInvoiceIds } },
        { paymentId: { in: related.supplierPaymentIds } },
      ],
    },
  });

  await tx.supplierPriceHistory.deleteMany({
    where: { companyId, supplierId: { in: related.supplierIds } },
  });

  await tx.supplierPayment.deleteMany({
    where: { id: { in: related.supplierPaymentIds }, companyId },
  });

  await tx.purchaseInvoice.deleteMany({
    where: { id: { in: related.purchaseInvoiceIds }, companyId },
  });

  await tx.lpoReceipt.deleteMany({
    where: { companyId, lpoId: { in: related.lpoIds } },
  });

  await tx.lpo.deleteMany({
    where: { id: { in: related.lpoIds }, companyId },
  });

  if (related.hrEmployeeIds.length) {
    await tx.hRPayrollEntry.deleteMany({
      where: { companyId, employeeId: { in: related.hrEmployeeIds } },
    });
    await tx.hRLeaveRequest.deleteMany({
      where: { companyId, employeeId: { in: related.hrEmployeeIds } },
    });
    await tx.hRLeaveBalance.deleteMany({
      where: { companyId, employeeId: { in: related.hrEmployeeIds } },
    });
    await tx.hRAttendance.deleteMany({
      where: { companyId, employeeId: { in: related.hrEmployeeIds } },
    });
    await tx.hREmployee.deleteMany({
      where: { id: { in: related.hrEmployeeIds }, companyId },
    });
  }

  if (related.hrPayrollPeriodIds.length) {
    await tx.hRPayrollPeriod.deleteMany({
      where: { id: { in: related.hrPayrollPeriodIds }, companyId },
    });
  }
  if (related.hrLeaveTypeIds.length) {
    await tx.hRLeaveType.deleteMany({
      where: { id: { in: related.hrLeaveTypeIds }, companyId },
    });
  }
  if (related.hrDesignationIds.length) {
    await tx.hRDesignation.deleteMany({
      where: { id: { in: related.hrDesignationIds }, companyId },
    });
  }
  if (related.hrDepartmentIds.length) {
    await tx.hRDepartment.deleteMany({
      where: { id: { in: related.hrDepartmentIds }, companyId },
    });
  }
  if (related.hrLocationIds.length) {
    await tx.hRWorkLocation.deleteMany({
      where: { id: { in: related.hrLocationIds }, companyId },
    });
  }

  // Legacy v2 cleanup when metadata was not stored.
  if (!related.hrDepartmentIds.length) {
    await tx.hRPayrollPeriod.deleteMany({
      where: { companyId, name: { startsWith: 'SAMPLE' } },
    });
    await tx.hRLeaveType.deleteMany({
      where: { companyId, OR: [{ name: { startsWith: '[Sample]' } }, { code: { startsWith: 'SAMPLE-' } }] },
    });
    await tx.hRDesignation.deleteMany({
      where: { companyId, name: { startsWith: '[Sample]' } },
    });
    await tx.hRDepartment.deleteMany({
      where: { companyId, name: { startsWith: '[Sample]' } },
    });
    await tx.hRWorkLocation.deleteMany({
      where: { companyId, name: { startsWith: '[Sample]' } },
    });
  }

  await tx.invoice.deleteMany({
    where: { id: { in: related.invoiceIds }, companyId },
  });
  await tx.advancePayment.deleteMany({
    where: { id: { in: related.advanceIds }, companyId },
  });
  await tx.job.deleteMany({
    where: { id: { in: related.jobIds }, companyId },
  });
  await tx.quotation.deleteMany({
    where: { id: { in: related.quoteIds }, companyId },
  });
  await tx.product.deleteMany({
    where: { id: { in: related.productIds }, companyId },
  });
  await tx.customer.deleteMany({
    where: { id: { in: related.customerIds }, companyId },
  });
  await tx.supplier.deleteMany({
    where: { id: { in: related.supplierIds }, companyId },
  });
  await tx.quotationLookup.deleteMany({
    where: { id: { in: related.lookupIds }, companyId },
  });
}

export async function countSampleSet(
  tx: Prisma.TransactionClient,
  companyId: string,
  sampleSetId: string,
) {
  const related = await collectSampleRelated(tx, companyId, sampleSetId);
  return {
    suppliers: related.supplierIds.length,
    products: related.productIds.length,
    customers: related.customerIds.length,
    quotations: related.quoteIds.length,
    jobs: related.jobIds.length,
    invoices: related.invoiceIds.length,
    advances: related.advanceIds.length,
    lookups: related.lookupIds.length,
    lpos: related.lpoIds.length,
    purchaseInvoices: related.purchaseInvoiceIds.length,
    supplierPayments: related.supplierPaymentIds.length,
    hrEmployees: related.hrEmployeeIds.length,
  };
}

export { ids, round, addDays };
