import { Injectable, NotFoundException } from '@nestjs/common';
import { roundMoney } from '@marble/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionContext } from '../auth/session.types';

export type SupplierInput = {
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  trn?: string | null;
  notes?: string | null;
  active?: boolean;
};

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.supplier.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async get(companyId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId },
      include: {
        products: {
          orderBy: { name: 'asc' },
          include: { images: true },
        },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async hub(companyId: string, id: string) {
    const supplier = await this.get(companyId, id);
    const [products, quotationLines, lpos, purchaseInvoices, payments, ledgerEntries, priceHistory] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId, supplierId: id },
        orderBy: { name: 'asc' },
        include: { images: true },
      }),
      this.prisma.quotationLine.findMany({
        where: {
          quotation: { companyId },
          product: { supplierId: id },
        },
        include: {
          quotation: { select: { id: true, number: true, status: true, customer: { select: { name: true } } } },
          product: { select: { name: true } },
        },
        orderBy: { quotation: { createdAt: 'desc' } },
      }),
      this.prisma.lpo.findMany({
        where: { companyId, supplierId: id },
        orderBy: { createdAt: 'desc' },
        include: { lines: true },
      }),
      this.prisma.purchaseInvoice.findMany({
        where: { companyId, supplierId: id },
        orderBy: { issueDate: 'desc' },
        include: { lpo: { select: { id: true, number: true } } },
      }),
      this.prisma.supplierPayment.findMany({
        where: { companyId, supplierId: id },
        orderBy: { paidAt: 'desc' },
        include: { allocations: true },
      }),
      this.prisma.supplierLedgerEntry.findMany({
        where: { companyId, supplierId: id },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.supplierPriceHistory.findMany({
        where: { companyId, supplierId: id },
        orderBy: { effectiveAt: 'desc' },
        take: 100,
        select: { id: true, productName: true, unitCost: true, currency: true, effectiveAt: true, sourceType: true },
      }),
    ]);
    const purchaseValue = products.reduce((sum, product) => sum + product.purchasePrice, 0);
    const sellValue = products.reduce((sum, product) => sum + product.sellPrice, 0);
    const quotedCost = quotationLines.reduce((sum, line) => sum + line.purchasePrice * line.qty, 0);
    const quotedValue = quotationLines.reduce((sum, line) => sum + line.sellPrice * line.qty, 0);
    return {
      supplier,
      products,
      quotationLines,
      lpos,
      purchaseInvoices,
      payments: payments.map(({ reference, ...payment }) => ({
        ...payment,
        reference: reference ? `••••${reference.slice(-4)}` : null,
      })),
      priceHistory,
      finance: {
        payable: roundMoney(ledgerEntries.reduce((sum, entry) => sum + (entry.direction === 'credit' ? entry.amount : -entry.amount), 0)),
        overdue: roundMoney(purchaseInvoices.filter((invoice) => invoice.dueDate && invoice.dueDate < new Date() && ['posted', 'partially_paid'].includes(invoice.status)).reduce((sum, invoice) => sum + invoice.balance, 0)),
        advances: roundMoney(payments.reduce((sum, payment) => sum + payment.unappliedAmount, 0)),
        openLpos: lpos.filter((lpo) => !['closed', 'cancelled'].includes(lpo.status)).length,
        pendingReceipts: lpos.reduce((sum, lpo) => sum + lpo.lines.filter((line) => line.receivedQty < line.orderedQty).length, 0),
        postedPurchaseInvoices: purchaseInvoices.filter((invoice) => ['posted', 'partially_paid', 'paid'].includes(invoice.status)).length,
      },
      summary: {
        productCount: products.length,
        activeProductCount: products.filter((product) => product.active).length,
        catalogPurchaseValue: roundMoney(purchaseValue),
        catalogSellValue: roundMoney(sellValue),
        quotedCost: roundMoney(quotedCost),
        quotedValue: roundMoney(quotedValue),
        estimatedQuotedMargin: roundMoney(quotedValue - quotedCost),
      },
      note: 'Supplier hub values are catalog and quotation cost analytics. Payables require supplier purchasing/payment transactions, which are not part of the current accounting schema.',
    };
  }

  async create(session: SessionContext, input: SupplierInput) {
    const supplier = await this.prisma.supplier.create({
      data: {
        companyId: session.companyId,
        name: input.name,
        contact: input.contact ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        trn: input.trn ?? null,
        notes: input.notes ?? null,
        active: input.active ?? true,
      },
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Supplier',
      entityId: supplier.id,
      action: 'create',
      after: supplier,
    });

    return supplier;
  }

  async update(session: SessionContext, id: string, input: SupplierInput) {
    const before = await this.prisma.supplier.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Supplier not found');

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: input.name,
        contact: input.contact ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        trn: input.trn ?? null,
        notes: input.notes ?? null,
        active: input.active ?? before.active,
      },
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Supplier',
      entityId: id,
      action: 'update',
      before,
      after: supplier,
    });

    return supplier;
  }

  async remove(session: SessionContext, id: string) {
    const before = await this.prisma.supplier.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Supplier not found');

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: { active: false },
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Supplier',
      entityId: id,
      action: 'deactivate',
      before,
      after: supplier,
    });

    return { ok: true };
  }
}
