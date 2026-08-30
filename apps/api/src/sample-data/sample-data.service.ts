import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

const TEMPLATE_KEY = 'enterprise-hub-trial';
const TEMPLATE_VERSION = 1;

const SUPPLIERS = [
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

const PRODUCTS = [
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

const CUSTOMERS = [
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

function round(value: number) {
  return Number(value.toFixed(2));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function ids(rows: Array<{ id: string }>) {
  return rows.map((row) => row.id);
}

@Injectable()
export class SampleDataService {
  constructor(private readonly prisma: PrismaService) {}

  private async lock(tx: Prisma.TransactionClient, companyId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:${TEMPLATE_KEY}`}))`;
  }

  private async assertTrial(
    tx: Prisma.TransactionClient | PrismaService,
    companyId: string,
  ) {
    const subscription = await tx.companySubscription.findUnique({
      where: { companyId },
      select: { status: true, expiresAt: true },
    });
    if (
      !subscription ||
      subscription.status !== 'trial' ||
      (subscription.expiresAt && subscription.expiresAt <= new Date())
    ) {
      throw new BadRequestException(
        'Sample data is available only during an active trial.',
      );
    }
  }

  private async setFor(
    tx: Prisma.TransactionClient | PrismaService,
    companyId: string,
  ) {
    return tx.sampleDataSet.findUnique({
      where: {
        companyId_templateKey: { companyId, templateKey: TEMPLATE_KEY },
      },
    });
  }

  private async countSet(
    tx: Prisma.TransactionClient | PrismaService,
    companyId: string,
    sampleSetId: string,
  ) {
    const [
      suppliers,
      products,
      customers,
      quotations,
      jobs,
      invoices,
      advances,
      lookups,
    ] = await Promise.all([
      tx.supplier.count({ where: { companyId, sampleSetId } }),
      tx.product.count({ where: { companyId, sampleSetId } }),
      tx.customer.count({ where: { companyId, sampleSetId } }),
      tx.quotation.count({ where: { companyId, sampleSetId } }),
      tx.job.count({ where: { companyId, sampleSetId } }),
      tx.invoice.count({ where: { companyId, sampleSetId } }),
      tx.advancePayment.count({ where: { companyId, sampleSetId } }),
      tx.quotationLookup.count({ where: { companyId, sampleSetId } }),
    ]);
    return { suppliers, products, customers, quotations, jobs, invoices, advances, lookups };
  }

  async status(companyId: string) {
    const set = await this.setFor(this.prisma, companyId);
    let eligible = true;
    try {
      await this.assertTrial(this.prisma, companyId);
    } catch {
      eligible = false;
    }
    const counts = set?.status === 'loaded'
      ? await this.countSet(this.prisma, companyId, set.id)
      : null;
    return {
      eligible,
      templateKey: TEMPLATE_KEY,
      templateVersion: TEMPLATE_VERSION,
      status: set?.status ?? 'not_loaded',
      counts,
      canLoad: eligible && set?.status !== 'loaded',
      canErase: eligible && set?.status === 'loaded',
    };
  }

  async load(companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, companyId);
      await this.assertTrial(tx, companyId);
      const existing = await this.setFor(tx, companyId);
      if (existing?.status === 'loaded') {
        return {
          ok: true,
          status: existing.status,
          counts: await this.countSet(tx, companyId, existing.id),
        };
      }
      const sampleSet = existing
        ? await tx.sampleDataSet.update({
            where: { id: existing.id },
            data: {
              status: 'loaded',
              templateVersion: TEMPLATE_VERSION,
              loadedAt: new Date(),
              erasedAt: null,
              error: null,
            },
          })
        : await tx.sampleDataSet.create({
            data: {
              companyId,
              templateKey: TEMPLATE_KEY,
              templateVersion: TEMPLATE_VERSION,
              status: 'loaded',
            },
          });

      await this.createFixture(tx, companyId, sampleSet.id);
      return {
        ok: true,
        status: sampleSet.status,
        counts: await this.countSet(tx, companyId, sampleSet.id),
      };
    });
  }

  private async createFixture(
    tx: Prisma.TransactionClient,
    companyId: string,
    sampleSetId: string,
  ) {
    const suppliers = await tx.supplier.createMany({
      data: SUPPLIERS.map(([name, address, email], index) => ({
        companyId,
        sampleSetId,
        sampleKey: `supplier-${index + 1}`,
        name,
        contact: `Sample purchasing contact ${index + 1}`,
        phone: `+97150100${String(index + 1).padStart(4, '0')}`,
        email,
        address,
        notes: 'Generic Enterprise Hub trial sample',
        active: true,
      })),
    });
    void suppliers;
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
        supplierId: supplierByKey.get(`supplier-${(index % SUPPLIERS.length) + 1}`),
        name,
        sku,
        unit: 'sqm',
        purchasePrice,
        sellPrice,
        description: `Premium ${name.toLowerCase()} for trial demonstrations.`,
        active: true,
      })),
    });
    const productRows = await tx.product.findMany({
      where: { companyId, sampleSetId },
      select: { id: true, sampleKey: true, purchasePrice: true, sellPrice: true, name: true, unit: true },
      orderBy: { createdAt: 'asc' },
    });
    const productByKey = new Map(productRows.map((row) => [row.sampleKey ?? '', row]));

    await tx.customer.createMany({
      data: CUSTOMERS.map(([name, contact, city], index) => ({
        companyId,
        sampleSetId,
        sampleKey: `customer-${index + 1}`,
        name,
        contact,
        phone: `+97152110${String(index + 1).padStart(4, '0')}`,
        email: `customer${index + 1}@sample.example`,
        address: `${city}, United Arab Emirates`,
        trn: index % 3 === 0 ? `100000000000${String(index + 1).padStart(3, '0')}` : null,
        notes: 'Generic Enterprise Hub trial sample customer',
        active: true,
      })),
    });
    const customerRows = await tx.customer.findMany({
      where: { companyId, sampleSetId },
      select: { id: true, sampleKey: true },
      orderBy: { createdAt: 'asc' },
    });
    const customerByKey = new Map(customerRows.map((row) => [row.sampleKey ?? '', row.id]));

    await tx.quotationLookup.createMany({
      data: [
        ['lookup-terms', 'terms', 'Standard payment terms', '80% advance and 20% before completion.'],
        ['lookup-bank', 'bank', 'Bank transfer details', 'Sample Emirates bank transfer instructions.'],
        ['lookup-note', 'notes', 'Project notes', 'Site measurement and shop drawing approval included.'],
        ['lookup-warranty', 'notes', 'Warranty', 'Workmanship warranty applies for twelve months.'],
        ['lookup-counter', 'spec', 'Countertop scope', 'Cutting, fabrication, edge finishing and installation.'],
        ['lookup-delivery', 'terms', 'Delivery terms', 'Material delivery is coordinated after approval.'],
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
    const approvedQuotes: Array<{ id: string; customerId: string; productId: string; index: number }> = [];
    for (let index = 0; index < 16; index += 1) {
      const customerId = customerByKey.get(`customer-${index + 1}`);
      const product = productByKey.get(`product-${(index % PRODUCTS.length) + 1}`);
      if (!customerId || !product) continue;
      const status = index < 12 ? 'approved' : index < 14 ? 'draft' : 'cancelled';
      const qty = 12 + index * 2;
      const subtotal = round(qty * product.sellPrice);
      const vatAmount = round(subtotal * 0.05);
      const quote = await tx.quotation.create({
        data: {
          companyId,
          sampleSetId,
          sampleKey: `quotation-${index + 1}`,
          customerId,
          number: `SAMPLE-QT-${String(index + 1).padStart(4, '0')}`,
          kind: index % 4 === 0 ? 'counter_top' : 'general',
          status,
          title: `${CUSTOMERS[index][0]} stone package`,
          notes: 'Generic trial quotation for demonstration and reporting.',
          contactName: CUSTOMERS[index][1],
          contactPhone: `+97152110${String(index + 1).padStart(4, '0')}`,
          location: `${CUSTOMERS[index][2]}, UAE`,
          validUntil: addDays(now, 15 + index),
          subtotal,
          vatAmount,
          total: round(subtotal + vatAmount),
          purchaseTotal: round(qty * product.purchasePrice),
          approvedAt: status === 'approved' ? addDays(now, -index) : null,
          cancelledAt: status === 'cancelled' ? addDays(now, -2) : null,
          lines: {
            create: [{
              productId: product.id,
              description: product.name,
              unit: product.unit,
              qty,
              purchasePrice: product.purchasePrice,
              sellPrice: product.sellPrice,
              lineTotal: subtotal,
              sortOrder: 0,
            }],
          },
          lookupLinks: {
            create: lookupRows.slice(0, index % 3 + 2).map((row) => ({ lookupId: row.id })),
          },
        },
      });
      if (status === 'approved') {
        approvedQuotes.push({ id: quote.id, customerId, productId: product.id, index });
      }
    }

    for (const [jobIndex, quote] of approvedQuotes.entries()) {
      const product = productByKey.get(`product-${(quote.index % PRODUCTS.length) + 1}`);
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
          number: `SAMPLE-JOB-${String(jobIndex + 1).padStart(4, '0')}`,
          status: jobIndex < 8 ? 'open' : jobIndex < 11 ? 'completed' : 'closed',
          title: `Installation project ${jobIndex + 1}`,
          jobValue: total,
          jobNet: subtotal,
          purchaseTotal: round(qty * product.purchasePrice),
          completedAt: jobIndex >= 8 ? addDays(now, -jobIndex) : null,
          closedAt: jobIndex >= 11 ? addDays(now, -jobIndex) : null,
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
          number: `SAMPLE-ADV-${String(jobIndex + 1).padStart(4, '0')}`,
          amount: advanceAmount,
          allocatedAmount: 0,
          method: jobIndex % 2 === 0 ? 'bank_transfer' : 'cash',
          reference: `SAMPLE-TRX-${String(jobIndex + 1).padStart(4, '0')}`,
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
          number: `SAMPLE-INV-${String(jobIndex + 1).padStart(4, '0')}`,
          kind: jobIndex % 3 === 0 ? 'progressive' : jobIndex % 3 === 1 ? 'custom' : 'final',
          status: jobIndex === 10 ? 'cancelled' : 'issued',
          issueDate: addDays(now, -(jobIndex + 2)),
          dueDate: addDays(now, 14 - jobIndex),
          notes: 'Generic trial invoice for reporting and PDF testing.',
          subtotal: invoiceSubtotal,
          vatAmount: invoiceVat,
          total: invoiceTotal,
          purchaseTotal: round(qty * product.purchasePrice * (jobIndex % 3 === 0 ? 0.4 : 0.65)),
          advanceApplied: round(Math.min(advanceAmount, invoiceTotal * 0.35)),
          netPayable: round(invoiceTotal - Math.min(advanceAmount, invoiceTotal * 0.35)),
          lines: {
            create: [{
              description: product.name,
              unit: product.unit,
              qty: qty * (jobIndex % 3 === 0 ? 0.4 : 0.65),
              unitPrice: product.sellPrice,
              purchasePrice: product.purchasePrice,
              lineTotal: invoiceSubtotal,
              sortOrder: 0,
            }],
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

      if (jobIndex < 6) {
        const extraSubtotal = round(subtotal * 0.2);
        const extraVat = round(extraSubtotal * 0.05);
        await tx.invoice.create({
          data: {
            companyId,
            sampleSetId,
            sampleKey: `invoice-${jobIndex + 13}`,
            customerId: quote.customerId,
            jobId: job.id,
            number: `SAMPLE-INV-${String(jobIndex + 13).padStart(4, '0')}`,
            kind: 'progressive',
            status: 'issued',
            issueDate: addDays(now, -(jobIndex + 1)),
            dueDate: addDays(now, 21 - jobIndex),
            notes: 'Additional progressive billing sample.',
            subtotal: extraSubtotal,
            vatAmount: extraVat,
            total: round(extraSubtotal + extraVat),
            purchaseTotal: round(qty * product.purchasePrice * 0.2),
            netPayable: round(extraSubtotal + extraVat),
            lines: {
              create: [{
                description: `${product.name} — progress claim`,
                unit: product.unit,
                qty: qty * 0.2,
                unitPrice: product.sellPrice,
                purchasePrice: product.purchasePrice,
                lineTotal: extraSubtotal,
                sortOrder: 0,
              }],
            },
          },
        });
      }
    }

    for (let index = 0; index < 4; index += 1) {
      const customerId = customerByKey.get(`customer-${index + 15}`);
      if (!customerId) continue;
      await tx.advancePayment.create({
        data: {
          companyId,
          sampleSetId,
          sampleKey: `advance-${index + 13}`,
          customerId,
          number: `SAMPLE-ADV-${String(index + 13).padStart(4, '0')}`,
          amount: 900 + index * 275,
          allocatedAmount: 0,
          method: 'bank_transfer',
          reference: `SAMPLE-UNALLOC-${index + 1}`,
          receivedAt: addDays(now, -(index + 1)),
          notes: 'Unallocated advance sample.',
        },
      });
    }
  }

  private async collectRelated(
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
      tx.job.findMany({ where: { companyId }, select: { id: true, customerId: true, quotationId: true } }),
      tx.invoice.findMany({ where: { companyId }, select: { id: true, customerId: true, jobId: true } }),
      tx.advancePayment.findMany({ where: { companyId }, select: { id: true, customerId: true, jobId: true } }),
    ]);
    for (const quote of quotes) {
      if (
        customerIds.includes(quote.customerId) ||
        quote.lines.some((line) => line.productId && productIds.includes(line.productId)) ||
        quote.sections.some((section) => section.productId && productIds.includes(section.productId))
      ) {
        quoteIds.add(quote.id);
      }
    }
    for (const job of jobs) {
      if (customerIds.includes(job.customerId) || quoteIds.has(job.quotationId)) jobIds.add(job.id);
    }
    for (const invoice of invoices) {
      if (customerIds.includes(invoice.customerId) || (invoice.jobId && jobIds.has(invoice.jobId))) {
        invoiceIds.add(invoice.id);
      }
    }
    for (const advance of advances) {
      if (customerIds.includes(advance.customerId) || (advance.jobId && jobIds.has(advance.jobId))) {
        advanceIds.add(advance.id);
      }
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
    };
  }

  /**
   * Removes all tenant business data created during a trial while keeping the
   * company, profile, users, application history, and subscription row.
   * Callers must invoke this inside their subscription-conversion transaction.
   */
  async purgeTrialDataInTransaction(
    tx: Prisma.TransactionClient,
    companyId: string,
    preserveRenewalRequestId?: string,
  ) {
    const invoices = await tx.invoice.findMany({
      where: { companyId },
      select: { id: true },
    });
    const advances = await tx.advancePayment.findMany({
      where: { companyId },
      select: { id: true },
    });
    const invoiceIds = ids(invoices);
    const advanceIds = ids(advances);

    await tx.invoiceAdvanceAllocation.deleteMany({
      where: {
        OR: [
          { invoiceId: { in: invoiceIds } },
          { advanceId: { in: advanceIds } },
        ],
      },
    });
    await tx.ledgerEntry.deleteMany({ where: { companyId } });
    await tx.invoice.deleteMany({ where: { companyId } });
    await tx.advancePayment.deleteMany({ where: { companyId } });
    await tx.job.deleteMany({ where: { companyId } });
    await tx.quotation.deleteMany({ where: { companyId } });
    await tx.product.deleteMany({ where: { companyId } });
    await tx.customer.deleteMany({ where: { companyId } });
    await tx.supplier.deleteMany({ where: { companyId } });
    await tx.quotationLookup.deleteMany({ where: { companyId } });
    await tx.subscriptionRenewalRequest.deleteMany({
      where: {
        companyId,
        ...(preserveRenewalRequestId
          ? { id: { not: preserveRenewalRequestId } }
          : {}),
      },
    });
    await tx.supportRequest.deleteMany({ where: { companyId } });
    await tx.notification.deleteMany({ where: { companyId } });
    await tx.auditLog.deleteMany({ where: { companyId } });
    await tx.sampleDataSet.deleteMany({ where: { companyId } });
    await tx.company.update({
      where: { id: companyId },
      data: { dataEpoch: { increment: 1 } },
    });
  }

  async previewErase(companyId: string) {
    await this.assertTrial(this.prisma, companyId);
    const set = await this.setFor(this.prisma, companyId);
    if (!set || set.status !== 'loaded') {
      throw new NotFoundException('No loaded sample data exists for this company.');
    }
    return {
      templateKey: TEMPLATE_KEY,
      templateVersion: set.templateVersion,
      counts: await this.prisma.$transaction(async (tx) => {
        await this.lock(tx, companyId);
        const related = await this.collectRelated(tx, companyId, set.id);
        return {
          suppliers: related.supplierIds.length,
          products: related.productIds.length,
          customers: related.customerIds.length,
          quotations: related.quoteIds.length,
          jobs: related.jobIds.length,
          invoices: related.invoiceIds.length,
          advances: related.advanceIds.length,
        };
      }),
    };
  }

  async erase(companyId: string, confirmation: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, companyId);
      await this.assertTrial(tx, companyId);
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      if (!company) throw new NotFoundException('Company not found.');
      if (confirmation !== `ERASE ${company.name}`) {
        throw new ConflictException(
          `Type ERASE ${company.name} to permanently remove trial data.`,
        );
      }
      const set = await this.setFor(tx, companyId);
      if (!set || set.status !== 'loaded') {
        throw new NotFoundException('No loaded sample data exists for this company.');
      }
      const related = await this.collectRelated(tx, companyId, set.id);
      const entityIds = [
        ...related.supplierIds,
        ...related.productIds,
        ...related.customerIds,
        ...related.quoteIds,
        ...related.jobIds,
        ...related.invoiceIds,
        ...related.advanceIds,
        ...related.lookupIds,
      ];
      await tx.auditLog.deleteMany({
        where: { companyId, entityId: { in: entityIds } },
      });
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
      await tx.invoice.deleteMany({ where: { id: { in: related.invoiceIds }, companyId } });
      await tx.advancePayment.deleteMany({ where: { id: { in: related.advanceIds }, companyId } });
      await tx.job.deleteMany({ where: { id: { in: related.jobIds }, companyId } });
      await tx.quotation.deleteMany({ where: { id: { in: related.quoteIds }, companyId } });
      await tx.product.deleteMany({ where: { id: { in: related.productIds }, companyId } });
      await tx.customer.deleteMany({ where: { id: { in: related.customerIds }, companyId } });
      await tx.supplier.deleteMany({ where: { id: { in: related.supplierIds }, companyId } });
      await tx.quotationLookup.deleteMany({ where: { id: { in: related.lookupIds }, companyId } });
      await tx.company.update({
        where: { id: companyId },
        data: { dataEpoch: { increment: 1 } },
      });
      await tx.sampleDataSet.update({
        where: { id: set.id },
        data: { status: 'erased', erasedAt: new Date(), error: null },
      });
      return { ok: true, status: 'erased', counts: {
        suppliers: related.supplierIds.length,
        products: related.productIds.length,
        customers: related.customerIds.length,
        quotations: related.quoteIds.length,
        jobs: related.jobIds.length,
        invoices: related.invoiceIds.length,
        advances: related.advanceIds.length,
      } };
    });
  }
}
