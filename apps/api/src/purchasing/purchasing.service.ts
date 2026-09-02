import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Prisma } from '@prisma/client';
import { computePurchasingTotals, normalizeDiscount, roundMoney, type DiscountMode } from '@marble/domain';
import { DEFAULT_CURRENCY } from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberingService } from '../common/numbering.service';
import { SessionContext, isCompanySession, requireCompanyAdmin } from '../auth/session.types';
import { PRIVATE_UPLOADS_DIR } from '../uploads/uploads.constants';

type LpoInput = {
  supplierId: string;
  requestedDeliveryDate?: string | null;
  notes?: string | null;
  discountMode?: DiscountMode;
  discountValue?: number;
  lines: Array<{
    productId?: string | null;
    productName: string;
    unit?: string;
    orderedQty: number;
    unitCost: number;
    vatRate?: number;
    discountMode?: DiscountMode;
    discountValue?: number;
  }>;
};

type ReceiptInput = {
  receiptDate: string;
  note?: string | null;
  lines: Array<{ lpoLineId: string; receivedQty: number; varianceNote?: string | null }>;
};

type PurchaseInvoiceInput = {
  supplierId: string;
  lpoId?: string | null;
  supplierInvoiceNumber?: string | null;
  issueDate: string;
  dueDate?: string | null;
  taxInclusive?: boolean;
  notes?: string | null;
  discountMode?: DiscountMode;
  discountValue?: number;
  lines: Array<{
    lpoLineId?: string | null;
    productId?: string | null;
    productName: string;
    unit?: string;
    qty: number;
    unitCost: number;
    vatRate?: number;
    discountMode?: DiscountMode;
    discountValue?: number;
  }>;
};

type PaymentInput = {
  supplierId: string;
  paidAt: string;
  amount: number;
  method: string;
  reference?: string | null;
  notes?: string | null;
  allocations?: Array<{ purchaseInvoiceId: string; amount: number }>;
};

function parseDate(value: string | null | undefined, label: string, required = false) {
  if (!value) {
    if (required) throw new BadRequestException(`${label} is required`);
    return null;
  }
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new BadRequestException(`${label} must be a valid date`);
  return result;
}

function companyIdOf(session: SessionContext) {
  if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
  return session.companyId;
}

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {}

  private requireAdmin(session: SessionContext) {
    const companyId = companyIdOf(session);
    if (session.companyRole !== 'admin' || session.readOnly) {
      throw new ForbiddenException('Company admin access required.');
    }
    return companyId;
  }

  async listLpos(
    session: SessionContext,
    supplierId?: string,
    status?: string,
    invoiceEligible?: boolean,
  ) {
    const companyId = companyIdOf(session);
    const invoiceEligibleStatuses = ['approved', 'sent', 'partially_received'];
    return this.prisma.lpo.findMany({
      where: {
        companyId,
        ...(supplierId ? { supplierId } : {}),
        ...(invoiceEligible
          ? { status: { in: invoiceEligibleStatuses } }
          : status
            ? { status }
            : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { supplier: { select: { id: true, name: true } }, lines: true },
    });
  }

  async getLpo(session: SessionContext, id: string) {
    const companyId = companyIdOf(session);
    const lpo = await this.prisma.lpo.findFirst({
      where: { id, companyId },
      include: { supplier: true, lines: { orderBy: { sortOrder: 'asc' } }, receipts: { include: { lines: true }, orderBy: { receiptDate: 'desc' } }, purchaseInvoices: { select: { id: true, number: true, status: true, total: true, balance: true } } },
    });
    if (!lpo) throw new NotFoundException('LPO not found');
    return lpo;
  }

  async createLpo(session: SessionContext, input: LpoInput) {
    const companyId = this.requireAdmin(session);
    const supplier = await this.prisma.supplier.findFirst({ where: { id: input.supplierId, companyId, active: true }, select: { id: true } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!input.lines?.length) throw new BadRequestException('At least one LPO line is required');
    const profile = await this.prisma.companyProfile.findUnique({ where: { companyId }, select: { vatRate: true, currency: true } });
    const productIds = input.lines.map((line) => line.productId).filter((id): id is string => Boolean(id));
    const products = productIds.length ? await this.prisma.product.findMany({ where: { companyId, id: { in: productIds }, supplierId: input.supplierId }, select: { id: true, name: true, unit: true } }) : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const lines = input.lines.map((line, index) => {
      if (line.orderedQty <= 0 || line.unitCost < 0) throw new BadRequestException('LPO quantities must be positive and costs cannot be negative');
      const product = line.productId ? productById.get(line.productId) : undefined;
      if (line.productId && !product) throw new BadRequestException('LPO product must belong to the selected supplier');
      const vatRate = line.vatRate ?? profile?.vatRate ?? 0.05;
      return {
        companyId,
        productId: product?.id ?? null,
        productName: product?.name ?? line.productName.trim(),
        unit: product?.unit ?? line.unit ?? 'unit',
        orderedQty: line.orderedQty,
        unitCost: line.unitCost,
        vatRate,
        discountMode: line.discountMode ?? 'none',
        discountValue: line.discountValue ?? 0,
        lineTotal: 0,
        sortOrder: index,
        _vatRate: vatRate,
      };
    });
    const totals = computePurchasingTotals(
      lines.map((line) => ({
        qty: line.orderedQty,
        unitCost: line.unitCost,
        vatRate: line._vatRate,
        discountMode: line.discountMode,
        discountValue: line.discountValue,
      })),
      input,
    );
    const persistedLines = lines.map((line, index) => ({
      companyId: line.companyId,
      productId: line.productId,
      productName: line.productName,
      unit: line.unit,
      orderedQty: line.orderedQty,
      unitCost: line.unitCost,
      vatRate: line.vatRate,
      discountMode: line.discountMode,
      discountValue: line.discountValue,
      lineTotal: totals.lineTotals[index],
      sortOrder: line.sortOrder,
    }));
    const doc = normalizeDiscount(input);
    return this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, companyId, 'lpo');
      const lpo = await tx.lpo.create({ data: { companyId, supplierId: input.supplierId, number, currency: profile?.currency ?? DEFAULT_CURRENCY, requestedDeliveryDate: parseDate(input.requestedDeliveryDate, 'requestedDeliveryDate'), notes: input.notes?.trim() || null, discountMode: doc.discountMode, discountValue: doc.discountValue, discount: totals.discount, lineDiscountTotal: totals.lineDiscountTotal, subtotal: totals.subtotal, inputVat: totals.inputVat, total: totals.total, lines: { create: persistedLines } }, include: { lines: true, supplier: { select: { id: true, name: true } } } });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'Lpo', entityId: lpo.id, action: 'create', after: lpo });
      return lpo;
    });
  }

  async updateLpo(session: SessionContext, id: string, input: Partial<LpoInput>) {
    const companyId = this.requireAdmin(session);
    const before = await this.prisma.lpo.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!before) throw new NotFoundException('LPO not found');
    if (before.status !== 'draft') throw new ConflictException('Only draft LPOs can be edited');
    if (input.supplierId && input.supplierId !== before.supplierId) throw new ConflictException('Supplier cannot be changed after LPO creation');
    if (!input.lines) {
      return this.prisma.lpo.update({ where: { id }, data: { ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}), ...(input.requestedDeliveryDate !== undefined ? { requestedDeliveryDate: parseDate(input.requestedDeliveryDate, 'requestedDeliveryDate') } : {}) }, include: { lines: true } });
    }
    if (!input.lines.length) throw new BadRequestException('At least one LPO line is required');
    return this.prisma.$transaction(async (tx) => {
      const productIds = input.lines!.map((line) => line.productId).filter((productId): productId is string => Boolean(productId));
      const products = productIds.length ? await tx.product.findMany({ where: { companyId, id: { in: productIds }, supplierId: before.supplierId }, select: { id: true, name: true, unit: true } }) : [];
      const profile = await tx.companyProfile.findUnique({ where: { companyId }, select: { vatRate: true } });
      const productById = new Map(products.map((product) => [product.id, product]));
      const lines = input.lines!.map((line, index) => {
        const product = line.productId ? productById.get(line.productId) : undefined;
        if (line.productId && !product) throw new BadRequestException('LPO product must belong to the selected supplier');
        if (line.orderedQty <= 0 || line.unitCost < 0) throw new BadRequestException('LPO quantities must be positive and costs cannot be negative');
        const vatRate = line.vatRate ?? profile?.vatRate ?? 0.05;
        return {
          companyId,
          productId: product?.id ?? null,
          productName: product?.name ?? line.productName.trim(),
          unit: product?.unit ?? line.unit ?? 'unit',
          orderedQty: line.orderedQty,
          unitCost: line.unitCost,
          vatRate,
          discountMode: line.discountMode ?? 'none',
          discountValue: line.discountValue ?? 0,
          sortOrder: index,
          _vatRate: vatRate,
        };
      });
      const totals = computePurchasingTotals(
        lines.map((line) => ({
          qty: line.orderedQty,
          unitCost: line.unitCost,
          vatRate: line._vatRate,
          discountMode: line.discountMode,
          discountValue: line.discountValue,
        })),
        input,
      );
      const persistedLines = lines.map((line, index) => ({
        companyId: line.companyId,
        productId: line.productId,
        productName: line.productName,
        unit: line.unit,
        orderedQty: line.orderedQty,
        unitCost: line.unitCost,
        vatRate: line.vatRate,
        discountMode: line.discountMode,
        discountValue: line.discountValue,
        lineTotal: totals.lineTotals[index],
        sortOrder: line.sortOrder,
      }));
      const doc = normalizeDiscount(input);
      await tx.lpoLine.deleteMany({ where: { lpoId: id } });
      const lpo = await tx.lpo.update({ where: { id }, data: { ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}), ...(input.requestedDeliveryDate !== undefined ? { requestedDeliveryDate: parseDate(input.requestedDeliveryDate, 'requestedDeliveryDate') } : {}), discountMode: doc.discountMode, discountValue: doc.discountValue, discount: totals.discount, lineDiscountTotal: totals.lineDiscountTotal, subtotal: totals.subtotal, inputVat: totals.inputVat, total: totals.total, version: { increment: 1 }, lines: { create: persistedLines } }, include: { lines: true } });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'Lpo', entityId: id, action: 'update', before, after: lpo });
      return lpo;
    });
  }

  async transitionLpo(session: SessionContext, id: string, action: 'approve' | 'send' | 'close' | 'cancel') {
    const companyId = this.requireAdmin(session);
    const before = await this.prisma.lpo.findFirst({ where: { id, companyId } });
    if (!before) throw new NotFoundException('LPO not found');
    if ((action === 'approve' && before.status === 'approved') || (action === 'send' && before.status === 'sent')) return before;
    const transitions: Record<typeof action, string[]> = { approve: ['draft'], send: ['approved'], close: ['sent', 'partially_received'], cancel: ['draft', 'approved', 'sent'] };
    if (!transitions[action].includes(before.status)) throw new ConflictException(`Cannot ${action} an LPO in ${before.status} status`);
    const now = new Date();
    const status = action === 'approve' ? 'approved' : action === 'send' ? 'sent' : action === 'close' ? 'closed' : 'cancelled';
    const lpo = await this.prisma.lpo.update({ where: { id }, data: { status, ...(action === 'approve' ? { approvedAt: now } : {}), ...(action === 'send' ? { sentAt: now } : {}), ...(action === 'close' ? { closedAt: now } : {}), ...(action === 'cancel' ? { cancelledAt: now } : {}) } });
    await this.audit.write({ companyId, actorId: session.userId, entityType: 'Lpo', entityId: id, action, before, after: lpo });
    return lpo;
  }

  async receiveLpo(session: SessionContext, id: string, input: ReceiptInput) {
    const companyId = this.requireAdmin(session);
    const lpo = await this.prisma.lpo.findFirst({ where: { id, companyId }, include: { lines: true, receipts: { select: { number: true } } } });
    if (!lpo) throw new NotFoundException('LPO not found');
    if (!['sent', 'partially_received'].includes(lpo.status)) throw new ConflictException('LPO must be sent before receiving goods');
    const lineById = new Map(lpo.lines.map((line) => [line.id, line]));
    for (const received of input.lines) {
      const line = lineById.get(received.lpoLineId);
      if (!line) throw new BadRequestException('Receipt line does not belong to this LPO');
      if (received.receivedQty <= 0 || line.receivedQty + received.receivedQty > line.orderedQty) throw new BadRequestException(`Receipt exceeds ordered quantity for ${line.productName}`);
    }
    const number = `${lpo.number}-R${lpo.receipts.length + 1}`;
    const receiptDate = parseDate(input.receiptDate, 'receiptDate', true)!;
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.lpoReceipt.create({ data: { companyId, lpoId: id, number, receiptDate, note: input.note?.trim() || null, createdByUserId: session.userId, lines: { create: input.lines.map((line) => ({ companyId, lpoLineId: line.lpoLineId, receivedQty: line.receivedQty, varianceNote: line.varianceNote?.trim() || null })) } }, include: { lines: true } });
      for (const received of input.lines) await tx.lpoLine.update({ where: { id: received.lpoLineId }, data: { receivedQty: { increment: received.receivedQty } } });
      const updatedLines = await tx.lpoLine.findMany({ where: { lpoId: id } });
      const complete = updatedLines.every((line) => line.receivedQty >= line.orderedQty);
      const updatedLpo = await tx.lpo.update({ where: { id }, data: { status: complete ? 'closed' : 'partially_received', ...(complete ? { closedAt: new Date() } : {}) } });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'LpoReceipt', entityId: receipt.id, action: 'receive', after: { receipt, lpo: updatedLpo } });
      return receipt;
    });
  }

  async listPurchaseInvoices(session: SessionContext, supplierId?: string, status?: string) {
    const companyId = companyIdOf(session);
    const invoices = await this.prisma.purchaseInvoice.findMany({ where: { companyId, ...(supplierId ? { supplierId } : {}), ...(status ? { status } : {}) }, orderBy: { issueDate: 'desc' }, include: { supplier: { select: { id: true, name: true } }, lpo: { select: { id: true, number: true } } } });
    return invoices.map(({ attachmentUrl: _attachmentUrl, ...invoice }) => invoice);
  }

  async getPurchaseInvoice(session: SessionContext, id: string) {
    const companyId = companyIdOf(session);
    const invoice = await this.prisma.purchaseInvoice.findFirst({ where: { id, companyId }, include: { supplier: true, lpo: { include: { lines: true } }, lines: { orderBy: { createdAt: 'asc' } }, payments: { include: { payment: true } }, ledger: true } });
    if (!invoice) throw new NotFoundException('Purchase invoice not found');
    const { attachmentUrl: _attachmentUrl, ...safeInvoice } = invoice;
    return safeInvoice;
  }

  private async purchaseInvoiceData(tx: Prisma.TransactionClient, companyId: string, input: PurchaseInvoiceInput) {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, companyId, active: true }, select: { id: true } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!input.lines?.length) throw new BadRequestException('At least one purchase invoice line is required');
    const profile = await tx.companyProfile.findUnique({ where: { companyId }, select: { vatRate: true, currency: true } });
    const lpo = input.lpoId ? await tx.lpo.findFirst({ where: { id: input.lpoId, companyId, supplierId: input.supplierId }, include: { lines: true } }) : null;
    if (input.lpoId && !lpo) throw new NotFoundException('LPO not found for this supplier');
    if (lpo && ['draft', 'cancelled'].includes(lpo.status)) throw new ConflictException('Purchase invoice cannot use a draft or cancelled LPO');
    const productIds = input.lines.map((line) => line.productId).filter((id): id is string => Boolean(id));
    const products = productIds.length ? await tx.product.findMany({ where: { companyId, id: { in: productIds } }, select: { id: true, name: true, unit: true } }) : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const lpoLines = new Map((lpo?.lines ?? []).map((line) => [line.id, line]));
    const lines = input.lines.map((line) => {
      if (line.qty <= 0 || line.unitCost < 0) throw new BadRequestException('Purchase invoice quantities must be positive and costs cannot be negative');
      const product = line.productId ? productById.get(line.productId) : undefined;
      const linked = line.lpoLineId ? lpoLines.get(line.lpoLineId) : undefined;
      if (line.lpoLineId && !linked) throw new BadRequestException('Purchase invoice LPO line is invalid');
      const vatRate = line.vatRate ?? linked?.vatRate ?? profile?.vatRate ?? 0.05;
      return {
        companyId,
        lpoLineId: linked?.id ?? null,
        productId: product?.id ?? linked?.productId ?? null,
        productName: product?.name ?? linked?.productName ?? line.productName.trim(),
        unit: product?.unit ?? linked?.unit ?? line.unit ?? 'unit',
        qty: line.qty,
        unitCost: line.unitCost,
        vatRate,
        discountMode: line.discountMode ?? 'none',
        discountValue: line.discountValue ?? 0,
        _vatRate: vatRate,
      };
    });
    const totals = computePurchasingTotals(
      lines.map((line) => ({
        qty: line.qty,
        unitCost: line.unitCost,
        vatRate: line._vatRate,
        discountMode: line.discountMode,
        discountValue: line.discountValue,
      })),
      input,
      { taxInclusive: input.taxInclusive ?? false },
    );
    const persistedLines = lines.map((line, index) => ({
      companyId: line.companyId,
      lpoLineId: line.lpoLineId,
      productId: line.productId,
      productName: line.productName,
      unit: line.unit,
      qty: line.qty,
      unitCost: line.unitCost,
      vatRate: line.vatRate,
      discountMode: line.discountMode,
      discountValue: line.discountValue,
      lineTotal: totals.lineTotals[index],
    }));
    const doc = normalizeDiscount(input);
    return {
      lpo,
      lines: persistedLines,
      doc,
      subtotal: totals.subtotal,
      inputVat: totals.inputVat,
      total: totals.total,
      discount: totals.discount,
      lineDiscountTotal: totals.lineDiscountTotal,
    };
  }

  async createPurchaseInvoice(session: SessionContext, input: PurchaseInvoiceInput) {
    const companyId = this.requireAdmin(session);
    return this.prisma.$transaction(async (tx) => {
      const data = await this.purchaseInvoiceData(tx, companyId, input);
      if (input.supplierInvoiceNumber?.trim()) {
        const duplicate = await tx.purchaseInvoice.findFirst({ where: { companyId, supplierId: input.supplierId, supplierInvoiceNumber: input.supplierInvoiceNumber.trim() }, select: { id: true } });
        if (duplicate) throw new ConflictException('This supplier invoice reference already exists');
      }
      const number = await this.numbering.next(tx, companyId, 'purchaseInvoice');
      const invoice = await tx.purchaseInvoice.create({ data: { companyId, supplierId: input.supplierId, lpoId: input.lpoId || null, number, supplierInvoiceNumber: input.supplierInvoiceNumber?.trim() || null, issueDate: parseDate(input.issueDate, 'issueDate', true)!, dueDate: parseDate(input.dueDate, 'dueDate'), taxInclusive: input.taxInclusive ?? false, vatRate: data.lines[0]?.vatRate ?? 0.05, currency: (await tx.companyProfile.findUnique({ where: { companyId }, select: { currency: true } }))?.currency ?? DEFAULT_CURRENCY, discountMode: data.doc.discountMode, discountValue: data.doc.discountValue, discount: data.discount, lineDiscountTotal: data.lineDiscountTotal, subtotal: data.subtotal, inputVat: data.inputVat, total: data.total, balance: data.total, notes: input.notes?.trim() || null, lines: { create: data.lines } }, include: { lines: true, supplier: { select: { id: true, name: true } } } });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'PurchaseInvoice', entityId: invoice.id, action: 'create', after: invoice });
      return invoice;
    });
  }

  async updatePurchaseInvoice(session: SessionContext, id: string, input: Partial<PurchaseInvoiceInput>) {
    const companyId = this.requireAdmin(session);
    const before = await this.prisma.purchaseInvoice.findFirst({ where: { id, companyId }, include: { lines: true } });
    if (!before) throw new NotFoundException('Purchase invoice not found');
    if (before.status !== 'draft') throw new ConflictException('Only draft purchase invoices can be edited');
    return this.prisma.$transaction(async (tx) => {
      const merged: PurchaseInvoiceInput = {
        supplierId: input.supplierId ?? before.supplierId,
        lpoId: input.lpoId === undefined ? before.lpoId : input.lpoId,
        supplierInvoiceNumber: input.supplierInvoiceNumber === undefined ? before.supplierInvoiceNumber : input.supplierInvoiceNumber,
        issueDate: input.issueDate ?? before.issueDate.toISOString(),
        dueDate: input.dueDate === undefined ? before.dueDate?.toISOString() : input.dueDate,
        taxInclusive: input.taxInclusive ?? before.taxInclusive,
        notes: input.notes === undefined ? before.notes : input.notes,
        lines:
          input.lines ??
          before.lines.map((line) => ({
            lpoLineId: line.lpoLineId,
            productId: line.productId,
            productName: line.productName,
            unit: line.unit,
            qty: line.qty,
            unitCost: line.unitCost,
            vatRate: line.vatRate,
            discountMode: line.discountMode as DiscountMode,
            discountValue: line.discountValue,
          })),
        discountMode: (input.discountMode ??
          before.discountMode) as DiscountMode,
        discountValue: input.discountValue ?? before.discountValue,
      };
      const data = await this.purchaseInvoiceData(tx, companyId, merged);
      if (merged.supplierInvoiceNumber?.trim()) {
        const duplicate = await tx.purchaseInvoice.findFirst({ where: { companyId, supplierId: merged.supplierId, supplierInvoiceNumber: merged.supplierInvoiceNumber.trim(), NOT: { id } }, select: { id: true } });
        if (duplicate) throw new ConflictException('This supplier invoice reference already exists');
      }
      await tx.purchaseInvoiceLine.deleteMany({ where: { purchaseInvoiceId: id } });
      const updated = await tx.purchaseInvoice.update({ where: { id }, data: { supplierId: merged.supplierId, lpoId: merged.lpoId || null, supplierInvoiceNumber: merged.supplierInvoiceNumber?.trim() || null, issueDate: parseDate(merged.issueDate, 'issueDate', true)!, dueDate: parseDate(merged.dueDate, 'dueDate'), taxInclusive: merged.taxInclusive ?? false, vatRate: data.lines[0]?.vatRate ?? before.vatRate, discountMode: data.doc.discountMode, discountValue: data.doc.discountValue, discount: data.discount, lineDiscountTotal: data.lineDiscountTotal, subtotal: data.subtotal, inputVat: data.inputVat, total: data.total, balance: data.total, notes: merged.notes?.trim() || null, version: { increment: 1 }, lines: { create: data.lines } }, include: { lines: true } });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'PurchaseInvoice', entityId: id, action: 'update', before, after: updated });
      return updated;
    });
  }

  async postPurchaseInvoice(session: SessionContext, id: string, input: { allowVariance?: boolean; varianceReason?: string }) {
    const companyId = this.requireAdmin(session);
    const invoice = await this.prisma.purchaseInvoice.findFirst({ where: { id, companyId }, include: { lines: true, lpo: { include: { lines: true } } } });
    if (!invoice) throw new NotFoundException('Purchase invoice not found');
    if (invoice.status !== 'draft') throw new ConflictException('Only draft purchase invoices can be posted');
    if (invoice.lpo) {
      const receivedById = new Map(invoice.lpo.lines.map((line) => [line.id, line.receivedQty - line.invoicedQty]));
      const variance = invoice.lines.find((line) => line.lpoLineId && line.qty > (receivedById.get(line.lpoLineId) ?? 0));
      if (variance && (!input.allowVariance || !input.varianceReason?.trim())) throw new ConflictException('Invoice exceeds received LPO quantity; an explicit variance reason is required');
    }
    return this.prisma.$transaction(async (tx) => {
      const posted = await tx.purchaseInvoice.update({ where: { id }, data: { status: 'posted', postedAt: new Date() }, include: { lines: true } });
      await tx.supplierLedgerEntry.create({ data: { companyId, supplierId: invoice.supplierId, purchaseInvoiceId: id, direction: 'credit', amount: invoice.total, description: `Purchase invoice ${invoice.number}` } });
      for (const line of invoice.lines) {
        if (line.lpoLineId) await tx.lpoLine.update({ where: { id: line.lpoLineId }, data: { invoicedQty: { increment: line.qty } } });
        if (line.productId) await tx.supplierPriceHistory.create({ data: { companyId, supplierId: invoice.supplierId, productId: line.productId, productName: line.productName, unitCost: line.unitCost, currency: invoice.currency, sourceType: 'purchase_invoice', sourceId: id } });
      }
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'PurchaseInvoice', entityId: id, action: 'post', before: invoice, after: posted });
      return posted;
    });
  }

  async cancelPurchaseInvoice(session: SessionContext, id: string) {
    const companyId = this.requireAdmin(session);
    const invoice = await this.prisma.purchaseInvoice.findFirst({ where: { id, companyId } });
    if (!invoice) throw new NotFoundException('Purchase invoice not found');
    if (invoice.status === 'cancelled') throw new ConflictException('Purchase invoice is already cancelled');
    if (invoice.paidAmount > 0) throw new ConflictException('Reverse or refund payments before cancelling this invoice');
    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.purchaseInvoice.update({ where: { id }, data: { status: 'cancelled', cancelledAt: new Date(), balance: 0 } });
      if (invoice.status === 'posted') await tx.supplierLedgerEntry.create({ data: { companyId, supplierId: invoice.supplierId, purchaseInvoiceId: id, direction: 'debit', amount: invoice.total, description: `Reversal of purchase invoice ${invoice.number}` } });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'PurchaseInvoice', entityId: id, action: 'cancel', before: invoice, after: cancelled });
      return cancelled;
    });
  }

  async attachPurchaseInvoice(session: SessionContext, id: string, filename: string) {
    const companyId = this.requireAdmin(session);
    const invoice = await this.prisma.purchaseInvoice.findFirst({ where: { id, companyId }, select: { id: true, attachmentUrl: true } });
    if (!invoice) throw new NotFoundException('Purchase invoice not found');
    const storedName = basename(filename);
    const updated = await this.prisma.purchaseInvoice.update({ where: { id }, data: { attachmentUrl: `private/${storedName}` } });
    await this.audit.write({ companyId, actorId: session.userId, entityType: 'PurchaseInvoice', entityId: id, action: 'attach', before: invoice, after: updated });
    return { attached: true };
  }

  async purchaseInvoiceAttachment(session: SessionContext, id: string) {
    const companyId = companyIdOf(session);
    const invoice = await this.prisma.purchaseInvoice.findFirst({ where: { id, companyId }, select: { number: true, attachmentUrl: true } });
    if (!invoice || !invoice.attachmentUrl?.startsWith('private/')) throw new NotFoundException('Attachment not found');
    const filePath = join(PRIVATE_UPLOADS_DIR, basename(invoice.attachmentUrl));
    if (!existsSync(filePath)) throw new NotFoundException('Attachment file not found');
    return { filePath, filename: `${invoice.number}-attachment${filePath.slice(filePath.lastIndexOf('.'))}` };
  }

  async createSupplierPayment(session: SessionContext, input: PaymentInput) {
    const companyId = this.requireAdmin(session);
    if (input.amount <= 0) throw new BadRequestException('Payment amount must be positive');
    const allocations = input.allocations ?? [];
    if (allocations.some((allocation) => allocation.amount <= 0)) throw new BadRequestException('Payment allocations must be positive');
    if (roundMoney(allocations.reduce((sum, allocation) => sum + allocation.amount, 0)) > roundMoney(input.amount)) throw new BadRequestException('Allocations cannot exceed payment amount');
    return this.prisma.$transaction(async (tx) => {
      const invoiceIds = allocations.map((allocation) => allocation.purchaseInvoiceId);
      const invoices = invoiceIds.length ? await tx.purchaseInvoice.findMany({ where: { companyId, supplierId: input.supplierId, id: { in: invoiceIds }, status: { in: ['posted', 'partially_paid'] } } }) : [];
      const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
      for (const allocation of allocations) {
        const invoice = invoiceById.get(allocation.purchaseInvoiceId);
        if (!invoice) throw new NotFoundException('Payable invoice not found for supplier');
        if (allocation.amount > invoice.balance) throw new BadRequestException(`Payment exceeds balance for ${invoice.number}`);
      }
      const number = await this.numbering.next(tx, companyId, 'supplierPayment');
      const allocated = roundMoney(allocations.reduce((sum, allocation) => sum + allocation.amount, 0));
      const payment = await tx.supplierPayment.create({ data: { companyId, supplierId: input.supplierId, number, paidAt: parseDate(input.paidAt, 'paidAt', true)!, amount: input.amount, method: input.method.trim(), reference: input.reference?.trim() || null, notes: input.notes?.trim() || null, unappliedAmount: roundMoney(input.amount - allocated), status: 'draft', allocations: { create: allocations.map((allocation) => ({ companyId, purchaseInvoiceId: allocation.purchaseInvoiceId, amount: allocation.amount })) } }, include: { allocations: true } });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'SupplierPayment', entityId: payment.id, action: 'create', after: payment });
      return payment;
    });
  }

  async approveSupplierPayment(session: SessionContext, id: string) {
    const companyId = this.requireAdmin(session);
    const payment = await this.prisma.supplierPayment.findFirst({
      where: { id, companyId },
      include: { allocations: true },
    });
    if (!payment) throw new NotFoundException('Supplier payment not found');
    if (payment.status !== 'draft') throw new ConflictException('Only a draft supplier payment can be approved');
    return this.prisma.$transaction(async (tx) => {
      const invoiceIds = payment.allocations.map((allocation) => allocation.purchaseInvoiceId);
      const invoices = invoiceIds.length
        ? await tx.purchaseInvoice.findMany({
            where: { companyId, supplierId: payment.supplierId, id: { in: invoiceIds }, status: { in: ['posted', 'partially_paid'] } },
          })
        : [];
      const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
      for (const allocation of payment.allocations) {
        const invoice = invoiceById.get(allocation.purchaseInvoiceId);
        if (!invoice) throw new NotFoundException('Payable invoice not found for supplier');
        if (allocation.amount > invoice.balance) {
          throw new BadRequestException(`Payment exceeds balance for ${invoice.number}`);
        }
        const balance = roundMoney(invoice.balance - allocation.amount);
        await tx.purchaseInvoice.update({
          where: { id: invoice.id },
          data: { paidAmount: { increment: allocation.amount }, balance, status: balance <= 0 ? 'paid' : 'partially_paid' },
        });
      }
      const posted = await tx.supplierPayment.update({
        where: { id },
        data: { status: 'posted' },
        include: { allocations: true },
      });
      await tx.supplierLedgerEntry.create({
        data: {
          companyId,
          supplierId: payment.supplierId,
          paymentId: payment.id,
          direction: 'debit',
          amount: payment.amount,
          description: `Supplier payment ${payment.number}${payment.unappliedAmount > 0 ? ' including supplier advance' : ''}`,
        },
      });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'SupplierPayment', entityId: payment.id, action: 'approve', before: payment, after: posted });
      return posted;
    });
  }

  async listSupplierPayments(session: SessionContext, supplierId?: string) {
    const companyId = companyIdOf(session);
    const payments = await this.prisma.supplierPayment.findMany({ where: { companyId, ...(supplierId ? { supplierId } : {}) }, orderBy: { paidAt: 'desc' }, include: { supplier: { select: { id: true, name: true } }, allocations: { include: { purchaseInvoice: { select: { id: true, number: true } } } } } });
    return payments.map(({ reference, ...payment }) => ({ ...payment, reference: reference ? `••••${reference.slice(-4)}` : null }));
  }

  async reverseSupplierPayment(session: SessionContext, id: string) {
    const companyId = this.requireAdmin(session);
    const payment = await this.prisma.supplierPayment.findFirst({ where: { id, companyId }, include: { allocations: true } });
    if (!payment) throw new NotFoundException('Supplier payment not found');
    if (payment.status !== 'posted') throw new ConflictException('Only a posted supplier payment can be reversed');
    return this.prisma.$transaction(async (tx) => {
      const reversed = await tx.supplierPayment.update({ where: { id }, data: { status: 'reversed', reversedAt: new Date() }, include: { allocations: true } });
      for (const allocation of payment.allocations) {
        const invoice = await tx.purchaseInvoice.findUnique({ where: { id: allocation.purchaseInvoiceId } });
        if (invoice) {
          const balance = roundMoney(invoice.balance + allocation.amount);
          await tx.purchaseInvoice.update({ where: { id: invoice.id }, data: { paidAmount: { decrement: allocation.amount }, balance, status: balance >= invoice.total ? 'posted' : 'partially_paid' } });
        }
      }
      await tx.supplierLedgerEntry.create({ data: { companyId, supplierId: payment.supplierId, paymentId: id, direction: 'credit', amount: payment.amount, description: `Reversal of supplier payment ${payment.number}` } });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'SupplierPayment', entityId: id, action: 'reverse', before: payment, after: reversed });
      return reversed;
    });
  }

  async supplierStatement(session: SessionContext, supplierId: string, from?: string, to?: string) {
    const companyId = companyIdOf(session);
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, companyId }, select: { id: true, name: true } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const fromDate = parseDate(from, 'from');
    const toDate = parseDate(to, 'to');
    const entries = await this.prisma.supplierLedgerEntry.findMany({ where: { companyId, supplierId, ...(fromDate || toDate ? { occurredAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}) }, orderBy: { occurredAt: 'asc' } });
    let balance = 0;
    const rows = entries.map((entry) => { balance += entry.direction === 'credit' ? entry.amount : -entry.amount; return { ...entry, balance: roundMoney(balance) }; });
    return { supplier, from: fromDate?.toISOString() ?? null, to: toDate?.toISOString() ?? null, opening: 0, closing: roundMoney(balance), rows };
  }

  async removeLpo(session: SessionContext, id: string) {
    const s = requireCompanyAdmin(session);
    const lpo = await this.prisma.lpo.findFirst({
      where: { id, companyId: s.companyId },
      include: {
        lines: true,
        receipts: { select: { id: true } },
        purchaseInvoices: { select: { id: true } },
      },
    });
    if (!lpo) throw new NotFoundException('LPO not found');
    if (lpo.status !== 'draft') {
      throw new ConflictException('Only draft LPOs can be deleted');
    }
    if (lpo.receipts.length > 0 || lpo.lines.some((line) => line.receivedQty > 0)) {
      throw new ConflictException('Delete receipts before removing this LPO');
    }
    if (lpo.purchaseInvoices.length > 0) {
      throw new ConflictException(
        'Delete linked purchase invoices before removing this LPO',
      );
    }

    await this.prisma.lpo.delete({ where: { id } });
    await this.audit.write({
      companyId: s.companyId,
      actorId: s.userId,
      entityType: 'Lpo',
      entityId: id,
      action: 'delete',
      before: lpo,
    });
    return { ok: true, id };
  }

  async removePurchaseInvoice(session: SessionContext, id: string) {
    const s = requireCompanyAdmin(session);
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id, companyId: s.companyId },
      include: { payments: { select: { id: true } } },
    });
    if (!invoice) throw new NotFoundException('Purchase invoice not found');
    if (invoice.status !== 'draft') {
      throw new ConflictException('Only draft purchase invoices can be deleted');
    }
    if (invoice.payments.length > 0) {
      throw new ConflictException(
        'Remove payment allocations before deleting this invoice',
      );
    }

    if (invoice.attachmentUrl?.startsWith('private/')) {
      const filePath = join(PRIVATE_UPLOADS_DIR, basename(invoice.attachmentUrl));
      if (existsSync(filePath)) {
        await unlink(filePath).catch(() => undefined);
      }
    }

    await this.prisma.purchaseInvoice.delete({ where: { id } });
    await this.audit.write({
      companyId: s.companyId,
      actorId: s.userId,
      entityType: 'PurchaseInvoice',
      entityId: id,
      action: 'delete',
      before: invoice,
    });
    return { ok: true, id };
  }

  async removeSupplierPayment(session: SessionContext, id: string) {
    const s = requireCompanyAdmin(session);
    const payment = await this.prisma.supplierPayment.findFirst({
      where: { id, companyId: s.companyId },
    });
    if (!payment) throw new NotFoundException('Supplier payment not found');
    if (payment.status !== 'draft') {
      throw new ConflictException('Only draft supplier payments can be deleted');
    }

    await this.prisma.supplierPayment.delete({ where: { id } });
    await this.audit.write({
      companyId: s.companyId,
      actorId: s.userId,
      entityType: 'SupplierPayment',
      entityId: id,
      action: 'delete',
      before: payment,
    });
    return { ok: true, id };
  }
}
