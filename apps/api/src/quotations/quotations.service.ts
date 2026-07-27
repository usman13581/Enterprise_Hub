import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canApproveQuotation,
  canCancelQuotation,
  canEditQuotation,
  computeQuotationTotals,
} from '@marble/domain';
import type { QuotationInput, QuotationStatus } from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberingService } from '../common/numbering.service';
import { SessionContext } from '../auth/session.types';

const CUSTOMER_SELECT = { id: true, name: true, trn: true } as const;

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {}

  list(companyId: string, status?: QuotationStatus) {
    return this.prisma.quotation.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: CUSTOMER_SELECT },
        lines: { orderBy: { sortOrder: 'asc' } },
        job: { select: { id: true, number: true, status: true } },
      },
    });
  }

  async get(companyId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: CUSTOMER_SELECT },
        lines: { orderBy: { sortOrder: 'asc' } },
        job: { select: { id: true, number: true, status: true } },
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return this.withProfit(quotation);
  }

  async create(session: SessionContext, input: QuotationInput) {
    await this.assertCustomer(session.companyId, input.customerId);
    await this.assertProducts(session.companyId, input.lines);

    const totals = computeQuotationTotals(input.lines);

    const quotation = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(
        tx,
        session.companyId,
        'quotation',
      );

      return tx.quotation.create({
        data: {
          companyId: session.companyId,
          customerId: input.customerId,
          number,
          status: 'draft',
          title: input.title,
          notes: input.notes,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          total: totals.total,
          purchaseTotal: totals.purchaseTotal,
          lines: {
            create: input.lines.map((line, index) => ({
              productId: line.productId,
              description: line.description,
              unit: line.unit,
              qty: line.qty,
              purchasePrice: line.purchasePrice,
              sellPrice: line.sellPrice,
              lineTotal: totals.lineTotals[index],
              sortOrder: index,
            })),
          },
        },
        include: {
          customer: { select: CUSTOMER_SELECT },
          lines: { orderBy: { sortOrder: 'asc' } },
          job: { select: { id: true, number: true, status: true } },
        },
      });
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Quotation',
      entityId: quotation.id,
      action: 'create',
      after: quotation,
    });

    return this.withProfit(quotation);
  }

  async update(session: SessionContext, id: string, input: QuotationInput) {
    const before = await this.prisma.quotation.findFirst({
      where: { id, companyId: session.companyId },
      include: { lines: true },
    });
    if (!before) throw new NotFoundException('Quotation not found');
    if (!canEditQuotation(before.status as QuotationStatus)) {
      throw new ConflictException(
        `A ${before.status} quotation can no longer be edited`,
      );
    }

    await this.assertCustomer(session.companyId, input.customerId);
    await this.assertProducts(session.companyId, input.lines);

    const totals = computeQuotationTotals(input.lines);

    const quotation = await this.prisma.$transaction(async (tx) => {
      await tx.quotationLine.deleteMany({ where: { quotationId: id } });
      return tx.quotation.update({
        where: { id },
        data: {
          customerId: input.customerId,
          title: input.title,
          notes: input.notes,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          total: totals.total,
          purchaseTotal: totals.purchaseTotal,
          lines: {
            create: input.lines.map((line, index) => ({
              productId: line.productId,
              description: line.description,
              unit: line.unit,
              qty: line.qty,
              purchasePrice: line.purchasePrice,
              sellPrice: line.sellPrice,
              lineTotal: totals.lineTotals[index],
              sortOrder: index,
            })),
          },
        },
        include: {
          customer: { select: CUSTOMER_SELECT },
          lines: { orderBy: { sortOrder: 'asc' } },
          job: { select: { id: true, number: true, status: true } },
        },
      });
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Quotation',
      entityId: id,
      action: 'update',
      before,
      after: quotation,
    });

    return this.withProfit(quotation);
  }

  /** Approving is the only way a job comes into existence. */
  async approve(session: SessionContext, id: string) {
    const before = await this.prisma.quotation.findFirst({
      where: { id, companyId: session.companyId },
      include: { lines: true, job: true },
    });
    if (!before) throw new NotFoundException('Quotation not found');
    if (!canApproveQuotation(before.status as QuotationStatus)) {
      throw new ConflictException(
        `Only a draft quotation can be approved (this one is ${before.status})`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const jobNumber = await this.numbering.next(tx, session.companyId, 'job');

      const quotation = await tx.quotation.update({
        where: { id },
        data: { status: 'approved', approvedAt: new Date() },
        include: {
          customer: { select: CUSTOMER_SELECT },
          lines: { orderBy: { sortOrder: 'asc' } },
        },
      });

      const job = await tx.job.create({
        data: {
          companyId: session.companyId,
          customerId: quotation.customerId,
          quotationId: quotation.id,
          number: jobNumber,
          status: 'open',
          title: quotation.title,
          jobValue: quotation.total,
          jobNet: quotation.subtotal,
          purchaseTotal: quotation.purchaseTotal,
        },
      });

      return { quotation, job };
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Quotation',
      entityId: id,
      action: 'approve',
      before,
      after: result.quotation,
    });
    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Job',
      entityId: result.job.id,
      action: 'create',
      after: result.job,
    });

    return {
      ...this.withProfit({ ...result.quotation, job: result.job }),
      job: result.job,
    };
  }

  async cancel(session: SessionContext, id: string) {
    const before = await this.prisma.quotation.findFirst({
      where: { id, companyId: session.companyId },
      include: { lines: true },
    });
    if (!before) throw new NotFoundException('Quotation not found');
    if (!canCancelQuotation(before.status as QuotationStatus)) {
      throw new ConflictException(
        `A ${before.status} quotation cannot be cancelled`,
      );
    }

    const quotation = await this.prisma.quotation.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date() },
      include: {
        customer: { select: CUSTOMER_SELECT },
        lines: { orderBy: { sortOrder: 'asc' } },
        job: { select: { id: true, number: true, status: true } },
      },
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Quotation',
      entityId: id,
      action: 'cancel',
      before,
      after: quotation,
    });

    return this.withProfit(quotation);
  }

  async remove(session: SessionContext, id: string) {
    const before = await this.prisma.quotation.findFirst({
      where: { id, companyId: session.companyId },
      include: { job: true },
    });
    if (!before) throw new NotFoundException('Quotation not found');
    if (before.job) {
      throw new ConflictException(
        'This quotation has an approved job and cannot be deleted',
      );
    }

    await this.prisma.quotation.delete({ where: { id } });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Quotation',
      entityId: id,
      action: 'delete',
      before,
    });

    return { ok: true };
  }

  private withProfit<T extends { subtotal: number; purchaseTotal: number }>(
    quotation: T,
  ) {
    return {
      ...quotation,
      profit: Number((quotation.subtotal - quotation.purchaseTotal).toFixed(2)),
    };
  }

  private async assertCustomer(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
  }

  /**
   * Line product references are optional, but when supplied they must belong to
   * the same company — otherwise a quotation could quietly reference another
   * tenant's catalog.
   */
  private async assertProducts(
    companyId: string,
    lines: QuotationInput['lines'],
  ) {
    const ids = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
    if (ids.length === 0) return;

    const found = await this.prisma.product.findMany({
      where: { companyId, id: { in: ids as string[] } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException('One or more products were not found');
    }
  }
}
