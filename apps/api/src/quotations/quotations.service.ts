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
  computeCounterTopTotals,
  computeQuotationTotals,
  resolveCounterTopSectionAmount,
} from '@marble/domain';
import type { QuotationInput, QuotationStatus } from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberingService } from '../common/numbering.service';
import { SessionContext } from '../auth/session.types';
import { QuotationLookupsService } from './quotation-lookups.service';

const CUSTOMER_SELECT = { id: true, name: true, trn: true } as const;

const DETAIL_INCLUDE = {
  customer: { select: CUSTOMER_SELECT },
  lines: { orderBy: { sortOrder: 'asc' as const } },
  sections: {
    orderBy: { sortOrder: 'asc' as const },
    include: { items: { orderBy: { sortOrder: 'asc' as const } } },
  },
  lookupLinks: {
    include: { lookup: true },
  },
  job: { select: { id: true, number: true, status: true } },
} as const;

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly lookups: QuotationLookupsService,
  ) {}

  list(companyId: string, status?: QuotationStatus) {
    return this.prisma.quotation
      .findMany({
        where: { companyId, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        include: DETAIL_INCLUDE,
      })
      .then((rows) => rows.map((row) => this.shape(row)));
  }

  async get(companyId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, companyId },
      include: DETAIL_INCLUDE,
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return this.shape(quotation);
  }

  async create(session: SessionContext, input: QuotationInput) {
    await this.assertCustomer(session.companyId, input.customerId);
    await this.assertProducts(session.companyId, input);
    await this.assertLookups(session.companyId, input.lookupIds, input.kind);

    const totals = this.totalsFor(input);

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
          kind: input.kind,
          status: 'draft',
          title: input.title,
          notes: input.notes,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          location: input.location,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          discount: totals.discount,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          total: totals.total,
          purchaseTotal: totals.purchaseTotal,
          lines:
            input.kind === 'general'
              ? {
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
                }
              : undefined,
          sections:
            input.kind === 'counter_top'
              ? {
                  create: input.sections.map((section, index) => ({
                    productId: section.productId,
                    productName: section.productName,
                    amount: resolveCounterTopSectionAmount(
                      section.items,
                      section.amount,
                    ),
                    sortOrder: index,
                    items: {
                      create: section.items.map((item, itemIndex) => ({
                        label: item.label,
                        value: item.value,
                        amount: item.amount ?? 0,
                        sortOrder: itemIndex,
                      })),
                    },
                  })),
                }
              : undefined,
          lookupLinks: {
            create: input.lookupIds.map((lookupId) => ({ lookupId })),
          },
        },
        include: DETAIL_INCLUDE,
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

    if (input.kind === 'counter_top') {
      await this.lookups.ensureSpecLabels(
        session.companyId,
        this.specItemsFromInput(input),
      );
    }

    return this.shape(quotation);
  }

  async update(session: SessionContext, id: string, input: QuotationInput) {
    const before = await this.prisma.quotation.findFirst({
      where: { id, companyId: session.companyId },
      include: { lines: true, sections: true },
    });
    if (!before) throw new NotFoundException('Quotation not found');
    if (!canEditQuotation(before.status as QuotationStatus)) {
      throw new ConflictException(
        `A ${before.status} quotation can no longer be edited`,
      );
    }
    if (before.kind !== input.kind) {
      throw new BadRequestException('Quotation kind cannot be changed');
    }

    await this.assertCustomer(session.companyId, input.customerId);
    await this.assertProducts(session.companyId, input);
    await this.assertLookups(session.companyId, input.lookupIds, input.kind);

    const totals = this.totalsFor(input);

    const quotation = await this.prisma.$transaction(async (tx) => {
      await tx.quotationLine.deleteMany({ where: { quotationId: id } });
      await tx.quotationSection.deleteMany({ where: { quotationId: id } });
      await tx.quotationLookupLink.deleteMany({ where: { quotationId: id } });

      return tx.quotation.update({
        where: { id },
        data: {
          customerId: input.customerId,
          title: input.title,
          notes: input.notes,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          location: input.location,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          discount: totals.discount,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          total: totals.total,
          purchaseTotal: totals.purchaseTotal,
          lines:
            input.kind === 'general'
              ? {
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
                }
              : undefined,
          sections:
            input.kind === 'counter_top'
              ? {
                  create: input.sections.map((section, index) => ({
                    productId: section.productId,
                    productName: section.productName,
                    amount: resolveCounterTopSectionAmount(
                      section.items,
                      section.amount,
                    ),
                    sortOrder: index,
                    items: {
                      create: section.items.map((item, itemIndex) => ({
                        label: item.label,
                        value: item.value,
                        amount: item.amount ?? 0,
                        sortOrder: itemIndex,
                      })),
                    },
                  })),
                }
              : undefined,
          lookupLinks: {
            create: input.lookupIds.map((lookupId) => ({ lookupId })),
          },
        },
        include: DETAIL_INCLUDE,
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

    if (input.kind === 'counter_top') {
      await this.lookups.ensureSpecLabels(
        session.companyId,
        this.specItemsFromInput(input),
      );
    }

    return this.shape(quotation);
  }

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
        include: DETAIL_INCLUDE,
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
      ...this.shape({ ...result.quotation, job: result.job }),
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
      include: DETAIL_INCLUDE,
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

    return this.shape(quotation);
  }

  async remove(session: SessionContext, id: string) {
    return this.cancel(session, id);
  }

  private totalsFor(input: QuotationInput) {
    if (input.kind === 'counter_top') {
      const totals = computeCounterTopTotals(
        input.sections.map((section) =>
          resolveCounterTopSectionAmount(section.items, section.amount),
        ),
        input.discount ?? 0,
      );
      return { ...totals, lineTotals: [] as number[] };
    }
    const totals = computeQuotationTotals(input.lines);
    return { ...totals, discount: 0 };
  }

  private shape<
    T extends {
      subtotal: number;
      purchaseTotal: number;
      lookupLinks?: { lookup: unknown }[];
    },
  >(quotation: T) {
    const { lookupLinks, ...rest } = quotation;
    return {
      ...rest,
      lookups: (lookupLinks ?? []).map((link) => link.lookup),
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

  private async assertProducts(companyId: string, input: QuotationInput) {
    const ids = [
      ...new Set(
        [
          ...input.lines.map((l) => l.productId),
          ...input.sections.map((s) => s.productId),
        ].filter(Boolean),
      ),
    ] as string[];
    if (ids.length === 0) return;

    const found = await this.prisma.product.findMany({
      where: { companyId, id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException('One or more products were not found');
    }
  }

  private async assertLookups(
    companyId: string,
    lookupIds: string[],
    kind: QuotationInput['kind'],
  ) {
    if (lookupIds.length === 0) return;
    const unique = [...new Set(lookupIds)];
    const found = await this.prisma.quotationLookup.findMany({
      where: {
        companyId,
        id: { in: unique },
        active: true,
        OR: [{ appliesTo: 'both' }, { appliesTo: kind }],
      },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException(
        'One or more lookup items are missing or not valid for this quotation type',
      );
    }
  }

  private specItemsFromInput(input: QuotationInput) {
    return input.sections.flatMap((section) =>
      section.items
        .filter((item) => item.label.trim())
        .map((item) => ({ label: item.label, value: item.value })),
    );
  }
}
