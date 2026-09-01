import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canEditInvoice,
  canInvoiceJob,
  canIssueInvoice,
  checkAllocations,
  computeInvoiceTotals,
  jobFinancials,
  normalizeDiscount,
  progressiveLineAmount,
  unallocatedAmount,
  type DiscountMode,
} from '@marble/domain';
import type {
  CreditNoteInput,
  InvoiceInput,
  InvoiceKind,
  InvoiceLineInput,
  InvoiceStatus,
  JobStatus,
  ProgressiveInvoiceInput,
} from '@marble/types';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { NumberingService } from '../common/numbering.service';
import { SessionContext } from '../auth/session.types';

const INCLUDE = {
  customer: { select: { id: true, name: true, trn: true } },
  job: { select: { id: true, number: true, status: true } },
  lines: { orderBy: { sortOrder: 'asc' } },
  allocations: {
    include: {
      advance: { select: { id: true, number: true, receivedAt: true } },
    },
  },
} as const;

type AllocationRequest = { advanceId: string; amount: number };

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly numbering: NumberingService,
  ) {}

  list(
    companyId: string,
    filter?: { customerId?: string; jobId?: string; status?: InvoiceStatus },
  ) {
    return this.prisma.invoice.findMany({
      where: {
        companyId,
        ...(filter?.customerId ? { customerId: filter.customerId } : {}),
        ...(filter?.jobId ? { jobId: filter.jobId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: { issueDate: 'desc' },
      include: INCLUDE,
    });
  }

  async get(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: INCLUDE,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  /** Entry point used by the invoices dashboard, a job, or a customer hub. */
  async create(session: SessionContext, input: InvoiceInput) {
    await this.assertCustomer(session.companyId, input.customerId);
    if (input.jobId) {
      await this.assertJobInvoiceable(
        session.companyId,
        input.jobId,
        input.customerId,
      );
    }

    return this.persistDraft(session, {
      kind: input.kind,
      customerId: input.customerId,
      jobId: input.jobId,
      issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes,
      lines: input.lines,
      allocations: input.allocations,
      discountMode: input.discountMode,
      discountValue: input.discountValue,
    });
  }

  /**
   * Bills a share of an open job without hand-entering lines. The caller states
   * a gross intent (a percentage of job value, or an amount the customer will
   * pay) and the single line is stored net of VAT so the printed total matches.
   */
  async createProgressive(
    session: SessionContext,
    jobId: string,
    input: ProgressiveInvoiceInput,
    kind: Extract<InvoiceKind, 'progressive' | 'custom'> = 'progressive',
  ) {
    if (input.percentage === undefined && input.amount === undefined) {
      throw new BadRequestException(
        'Provide either a percentage of the job value or an amount',
      );
    }

    const job = await this.loadInvoiceableJob(session.companyId, jobId);
    const netAmount = progressiveLineAmount(job.jobValue, {
      percentage: input.percentage,
      amount: input.amount,
    });
    if (netAmount <= 0) {
      throw new BadRequestException('The resulting invoice amount is zero');
    }

    const label =
      input.description ??
      (input.percentage !== undefined
        ? `${input.percentage}% progress billing for job ${job.number}`
        : `Progress billing for job ${job.number}`);

    return this.persistDraft(session, {
      kind,
      customerId: job.customerId,
      jobId: job.id,
      issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes,
      lines: [
        {
          description: label,
          unit: 'job',
          qty: 1,
          unitPrice: netAmount,
          purchasePrice: 0,
          discountMode: 'none' as const,
          discountValue: 0,
        },
      ],
      allocations: input.allocations,
    });
  }

  /**
   * Settles whatever is still un-invoiced on a job in one document, so an
   * operator does not have to work the remainder out by hand.
   */
  async createFinal(
    session: SessionContext,
    jobId: string,
    input: ProgressiveInvoiceInput,
  ) {
    const job = await this.loadInvoiceableJob(session.companyId, jobId);
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId: session.companyId, jobId },
      select: { total: true, kind: true, status: true },
    });

    const financials = jobFinancials({
      jobValue: job.jobValue,
      jobNet: job.jobNet,
      purchaseTotal: job.purchaseTotal,
      advancesApplied: 0,
      invoices,
    });

    if (financials.balanceRemaining <= 0) {
      throw new ConflictException(
        'This job is already fully invoiced; nothing remains for a final invoice',
      );
    }

    const netAmount = progressiveLineAmount(0, {
      amount: financials.balanceRemaining,
    });

    return this.persistDraft(session, {
      kind: 'final',
      customerId: job.customerId,
      jobId: job.id,
      issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes,
      lines: [
        {
          description:
            input.description ?? `Final settlement for job ${job.number}`,
          unit: 'job',
          qty: 1,
          unitPrice: netAmount,
          purchasePrice: 0,
          discountMode: 'none' as const,
          discountValue: 0,
        },
      ],
      allocations: input.allocations,
    });
  }

  /** Reverses value from an issued invoice without deleting the original. */
  async createCreditNote(session: SessionContext, input: CreditNoteInput) {
    const original = await this.prisma.invoice.findFirst({
      where: { id: input.invoiceId, companyId: session.companyId },
    });
    if (!original) throw new NotFoundException('Invoice not found');
    if (original.status !== 'issued') {
      throw new ConflictException(
        'Only an issued invoice can be credited',
      );
    }
    if (original.kind === 'credit_note') {
      throw new ConflictException('Cannot credit a credit note');
    }

    const totals = computeInvoiceTotals(input.lines, 0, input);
    if (totals.total > original.total) {
      throw new BadRequestException(
        'A credit note cannot exceed the invoice it credits',
      );
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(
        tx,
        session.companyId,
        'creditNote',
      );

      const created = await tx.invoice.create({
        data: {
          companyId: session.companyId,
          customerId: original.customerId,
          jobId: original.jobId,
          number,
          kind: 'credit_note',
          status: 'draft',
          issueDate: new Date(),
          notes: input.reason,
          creditNoteForId: original.id,
          ...this.discountHeader(input, totals),
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          total: totals.total,
          purchaseTotal: totals.purchaseTotal,
          advanceApplied: 0,
          netPayable: totals.total,
          lines: {
            create: input.lines.map((line, index) => ({
              description: line.description,
              unit: line.unit,
              qty: line.qty,
              unitPrice: line.unitPrice,
              purchasePrice: line.purchasePrice,
              discountMode: line.discountMode ?? 'none',
              discountValue: line.discountValue ?? 0,
              lineTotal: totals.lineTotals[index],
              sortOrder: index,
            })),
          },
        },
        include: INCLUDE,
      });

      return created;
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Invoice',
      entityId: invoice.id,
      action: 'credit_note',
      after: invoice,
    });

    return invoice;
  }

  async update(session: SessionContext, id: string, input: InvoiceInput) {
    const before = await this.prisma.invoice.findFirst({
      where: { id, companyId: session.companyId },
      include: { lines: true, allocations: true },
    });
    if (!before) throw new NotFoundException('Invoice not found');
    if (!canEditInvoice(before.status as InvoiceStatus)) {
      throw new ConflictException('Only a draft invoice can be edited');
    }
    if (before.kind === 'credit_note') {
      throw new ConflictException('Edit a draft credit note by cancelling it and raising a new one');
    }

    await this.assertCustomer(session.companyId, input.customerId);
    if (input.jobId) {
      await this.assertJobInvoiceable(
        session.companyId,
        input.jobId,
        input.customerId,
      );
    }

    const prepared = await this.prepareDraft(session.companyId, {
      kind: input.kind,
      customerId: input.customerId,
      jobId: input.jobId,
      issueDate: input.issueDate ? new Date(input.issueDate) : before.issueDate,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes,
      lines: input.lines,
      allocations: input.allocations,
      discountMode: input.discountMode,
      discountValue: input.discountValue,
    });

    const invoice = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceAdvanceAllocation.deleteMany({ where: { invoiceId: id } });
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          customerId: prepared.customerId,
          jobId: prepared.jobId ?? null,
          kind: prepared.kind,
          issueDate: prepared.issueDate,
          dueDate: prepared.dueDate,
          notes: prepared.notes ?? null,
          ...this.discountHeader(prepared, prepared.totals),
          subtotal: prepared.totals.subtotal,
          vatAmount: prepared.totals.vatAmount,
          total: prepared.totals.total,
          purchaseTotal: prepared.totals.purchaseTotal,
          advanceApplied: prepared.totals.advanceApplied,
          netPayable: prepared.totals.netPayable,
          version: { increment: 1 },
          lines: {
            create: prepared.lines.map((line, index) => ({
              description: line.description,
              unit: line.unit,
              qty: line.qty,
              unitPrice: line.unitPrice,
              purchasePrice: line.purchasePrice,
              discountMode: line.discountMode ?? 'none',
              discountValue: line.discountValue ?? 0,
              lineTotal: prepared.totals.lineTotals[index],
              sortOrder: index,
            })),
          },
        },
        include: INCLUDE,
      });
      await this.storeAllocations(tx, updated.id, prepared.allocations);
      return tx.invoice.findUniqueOrThrow({
        where: { id },
        include: INCLUDE,
      });
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Invoice',
      entityId: id,
      action: 'update',
      before,
      after: invoice,
    });
    return invoice;
  }

  /**
   * Posts a draft: writes the ledger, claims any allocated advances, and
   * freezes the document. Drafts never move money.
   */
  async issue(session: SessionContext, id: string) {
    const before = await this.prisma.invoice.findFirst({
      where: { id, companyId: session.companyId },
      include: { allocations: true },
    });
    if (!before) throw new NotFoundException('Invoice not found');
    if (!canIssueInvoice(before.status as InvoiceStatus)) {
      throw new ConflictException('Only a draft invoice can be issued');
    }

    if (before.kind !== 'credit_note') {
      const allocationCheck = await this.checkStoredAllocations(
        session.companyId,
        before,
      );
      if (!allocationCheck.ok) {
        throw new BadRequestException(allocationCheck.error);
      }
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: { status: 'issued', issueDate: before.issueDate ?? new Date() },
        include: INCLUDE,
      });

      if (updated.kind === 'credit_note') {
        const original = updated.creditNoteForId
          ? await tx.invoice.findFirst({
              where: { id: updated.creditNoteForId, companyId: session.companyId },
              select: { number: true, status: true },
            })
          : null;
        if (!original || original.status !== 'issued') {
          throw new ConflictException(
            'The original invoice must still be issued to post this credit note',
          );
        }
        await this.ledger.record(tx, {
          companyId: session.companyId,
          customerId: updated.customerId,
          jobId: updated.jobId,
          invoiceId: updated.id,
          entryType: 'credit_note',
          amount: updated.total,
          occurredAt: updated.issueDate,
          memo: `Credit note ${updated.number} against ${original.number}`,
        });
      } else {
        await this.commitAllocations(tx, updated.allocations);
        await this.ledger.record(tx, {
          companyId: session.companyId,
          customerId: updated.customerId,
          jobId: updated.jobId,
          invoiceId: updated.id,
          entryType: 'invoice_issued',
          amount: updated.total,
          occurredAt: updated.issueDate,
          memo: `Invoice ${updated.number}`,
        });
      }

      return tx.invoice.findUniqueOrThrow({
        where: { id },
        include: INCLUDE,
      });
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Invoice',
      entityId: id,
      action: 'issue',
      before,
      after: invoice,
    });
    return invoice;
  }

  /**
   * Cancelling a draft just abandons it. Cancelling an issued invoice reverses
   * the ledger and releases any advances it had claimed.
   */
  async cancel(session: SessionContext, id: string) {
    const before = await this.prisma.invoice.findFirst({
      where: { id, companyId: session.companyId },
      include: { allocations: true },
    });
    if (!before) throw new NotFoundException('Invoice not found');
    if (before.status === 'cancelled') {
      throw new ConflictException('This invoice is already cancelled');
    }

    const wasIssued = before.status === 'issued';

    const invoice = await this.prisma.$transaction(async (tx) => {
      if (wasIssued) {
        for (const allocation of before.allocations) {
          await tx.advancePayment.update({
            where: { id: allocation.advanceId },
            data: { allocatedAmount: { decrement: allocation.amount } },
          });
        }
      }
      await tx.invoiceAdvanceAllocation.deleteMany({
        where: { invoiceId: id },
      });

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          advanceApplied: 0,
          netPayable: before.total,
        },
        include: INCLUDE,
      });

      if (wasIssued) {
        await this.ledger.record(tx, {
          companyId: session.companyId,
          customerId: updated.customerId,
          jobId: updated.jobId,
          invoiceId: updated.id,
          entryType: 'invoice_cancelled',
          amount: updated.total,
          memo: `Cancelled invoice ${updated.number}`,
        });
      }

      return updated;
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Invoice',
      entityId: id,
      action: 'cancel',
      before,
      after: invoice,
    });

    return invoice;
  }

  /** Shared save path for every non-credit-note invoice kind. */
  private async persistDraft(
    session: SessionContext,
    draft: {
      kind: InvoiceKind;
      customerId: string;
      jobId?: string | null;
      issueDate: Date;
      dueDate: Date | null;
      notes?: string | null;
      lines: InvoiceLineInput[];
      allocations: AllocationRequest[];
      discountMode?: DiscountMode;
      discountValue?: number;
    },
  ) {
    const prepared = await this.prepareDraft(session.companyId, draft);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(
        tx,
        session.companyId,
        'invoice',
      );

      const created = await tx.invoice.create({
        data: {
          companyId: session.companyId,
          customerId: prepared.customerId,
          jobId: prepared.jobId ?? null,
          number,
          kind: prepared.kind,
          status: 'draft',
          issueDate: prepared.issueDate,
          dueDate: prepared.dueDate,
          notes: prepared.notes ?? null,
          ...this.discountHeader(prepared, prepared.totals),
          subtotal: prepared.totals.subtotal,
          vatAmount: prepared.totals.vatAmount,
          total: prepared.totals.total,
          purchaseTotal: prepared.totals.purchaseTotal,
          advanceApplied: prepared.totals.advanceApplied,
          netPayable: prepared.totals.netPayable,
          lines: {
            create: prepared.lines.map((line, index) => ({
              description: line.description,
              unit: line.unit,
              qty: line.qty,
              unitPrice: line.unitPrice,
              purchasePrice: line.purchasePrice,
              discountMode: line.discountMode ?? 'none',
              discountValue: line.discountValue ?? 0,
              lineTotal: prepared.totals.lineTotals[index],
              sortOrder: index,
            })),
          },
        },
        include: INCLUDE,
      });

      await this.storeAllocations(tx, created.id, prepared.allocations);

      return tx.invoice.findUniqueOrThrow({
        where: { id: created.id },
        include: INCLUDE,
      });
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Invoice',
      entityId: invoice.id,
      action: 'create',
      after: invoice,
    });

    return invoice;
  }

  private async prepareDraft(
    companyId: string,
    draft: {
      kind: InvoiceKind;
      customerId: string;
      jobId?: string | null;
      issueDate: Date;
      dueDate: Date | null;
      notes?: string | null;
      lines: InvoiceLineInput[];
      allocations: AllocationRequest[];
      discountMode?: DiscountMode;
      discountValue?: number;
    },
  ) {
    const docDiscount = normalizeDiscount(draft);
    const provisional = computeInvoiceTotals(draft.lines, 0, docDiscount);
    if (provisional.total <= 0) {
      throw new BadRequestException('An invoice must have a positive total');
    }

    const advances = await this.prisma.advancePayment.findMany({
      where: {
        companyId,
        customerId: draft.customerId,
        status: 'posted',
        cancelledAt: null,
        ...(draft.allocations.length
          ? { id: { in: draft.allocations.map((a) => a.advanceId) } }
          : {}),
      },
    });

    const allocationCheck = checkAllocations(draft.allocations, advances, {
      customerId: draft.customerId,
      jobId: draft.jobId,
      invoiceTotal: provisional.total,
    });
    if (!allocationCheck.ok) {
      throw new BadRequestException(allocationCheck.error);
    }

    const totals = computeInvoiceTotals(
      draft.lines,
      allocationCheck.totalApplied,
      docDiscount,
    );

    return { ...draft, totals };
  }

  private async checkStoredAllocations(
    companyId: string,
    invoice: {
      customerId: string;
      jobId: string | null;
      total: number;
      allocations: AllocationRequest[];
    },
  ) {
    const advances = await this.prisma.advancePayment.findMany({
      where: {
        companyId,
        customerId: invoice.customerId,
        status: 'posted',
        cancelledAt: null,
        ...(invoice.allocations.length
          ? { id: { in: invoice.allocations.map((a) => a.advanceId) } }
          : {}),
      },
    });
    return checkAllocations(invoice.allocations, advances, {
      customerId: invoice.customerId,
      jobId: invoice.jobId,
      invoiceTotal: invoice.total,
    });
  }

  private async storeAllocations(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    allocations: AllocationRequest[],
  ) {
    const merged = new Map<string, number>();
    for (const allocation of allocations) {
      merged.set(
        allocation.advanceId,
        (merged.get(allocation.advanceId) ?? 0) + allocation.amount,
      );
    }

    for (const [advanceId, amount] of merged) {
      await tx.invoiceAdvanceAllocation.create({
        data: { invoiceId, advanceId, amount },
      });
    }
  }

  private async commitAllocations(
    tx: Prisma.TransactionClient,
    allocations: Array<{ advanceId: string; amount: number }>,
  ) {
    for (const allocation of allocations) {
      await tx.advancePayment.update({
        where: { id: allocation.advanceId },
        data: { allocatedAmount: { increment: allocation.amount } },
      });
    }
  }

  /** Advances a customer still has spare, oldest first, for the invoice UI. */
  async availableAdvances(
    companyId: string,
    customerId: string,
    jobId?: string,
  ) {
    const advances = await this.prisma.advancePayment.findMany({
      where: {
        companyId,
        customerId,
        status: 'posted',
        cancelledAt: null,
        ...(jobId ? { OR: [{ jobId }, { jobId: null }] } : {}),
      },
      orderBy: { receivedAt: 'asc' },
      include: { job: { select: { id: true, number: true } } },
    });

    return advances
      .map((advance) => ({
        ...advance,
        unallocatedAmount: unallocatedAmount(advance),
      }))
      .filter((advance) => advance.unallocatedAmount > 0);
  }

  private async assertCustomer(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
  }

  private async loadInvoiceableJob(companyId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, companyId },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (!canInvoiceJob(job.status as JobStatus)) {
      throw new ConflictException(
        'This job is closed and cannot be invoiced further',
      );
    }
    return job;
  }

  private async assertJobInvoiceable(
    companyId: string,
    jobId: string,
    customerId: string,
  ) {
    const job = await this.loadInvoiceableJob(companyId, jobId);
    if (job.customerId !== customerId) {
      throw new ConflictException('That job belongs to a different customer');
    }
    return job;
  }

  private discountHeader(
    input: { discountMode?: DiscountMode; discountValue?: number },
    totals: { discount: number; lineDiscountTotal: number },
  ) {
    const doc = normalizeDiscount(input);
    return {
      discountMode: doc.discountMode,
      discountValue: doc.discountValue,
      discount: totals.discount,
      lineDiscountTotal: totals.lineDiscountTotal,
    };
  }
}
