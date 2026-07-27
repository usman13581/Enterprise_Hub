import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { canRecordAdvanceForJob, unallocatedAmount } from '@marble/domain';
import type { AdvanceInput, JobStatus } from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { NumberingService } from '../common/numbering.service';
import { SessionContext } from '../auth/session.types';

const INCLUDE = {
  customer: { select: { id: true, name: true } },
  job: { select: { id: true, number: true } },
} as const;

@Injectable()
export class AdvancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly numbering: NumberingService,
  ) {}

  async list(companyId: string, filter?: { customerId?: string; jobId?: string }) {
    const advances = await this.prisma.advancePayment.findMany({
      where: {
        companyId,
        ...(filter?.customerId ? { customerId: filter.customerId } : {}),
        ...(filter?.jobId ? { jobId: filter.jobId } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      include: INCLUDE,
    });
    return advances.map((advance) => ({
      ...advance,
      unallocatedAmount: unallocatedAmount(advance),
    }));
  }

  async get(companyId: string, id: string) {
    const advance = await this.prisma.advancePayment.findFirst({
      where: { id, companyId },
      include: {
        ...INCLUDE,
        allocations: {
          include: {
            invoice: { select: { id: true, number: true, issueDate: true } },
          },
        },
      },
    });
    if (!advance) throw new NotFoundException('Advance not found');
    return { ...advance, unallocatedAmount: unallocatedAmount(advance) };
  }

  /**
   * Recording an advance is the moment cash is recognised, so it writes the
   * ledger credit here. Later allocation to an invoice moves no money.
   */
  async create(session: SessionContext, input: AdvanceInput) {
    await this.assertCustomer(session.companyId, input.customerId);
    if (input.jobId) {
      await this.assertJobAcceptsAdvance(
        session.companyId,
        input.jobId,
        input.customerId,
      );
    }

    const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();

    const advance = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(
        tx,
        session.companyId,
        'advance',
      );

      const created = await tx.advancePayment.create({
        data: {
          companyId: session.companyId,
          customerId: input.customerId,
          jobId: input.jobId,
          number,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
          receivedAt,
          notes: input.notes,
        },
        include: INCLUDE,
      });

      await this.ledger.record(tx, {
        companyId: session.companyId,
        customerId: created.customerId,
        jobId: created.jobId,
        advanceId: created.id,
        entryType: 'advance_received',
        amount: created.amount,
        occurredAt: receivedAt,
        memo: `Advance ${created.number}`,
      });

      return created;
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'AdvancePayment',
      entityId: advance.id,
      action: 'create',
      after: advance,
    });

    return { ...advance, unallocatedAmount: unallocatedAmount(advance) };
  }

  /**
   * Editing is only allowed while nothing has been allocated, because changing
   * the amount underneath an allocation would let an invoice claim more advance
   * than was ever received. The matching ledger credit is rewritten in step.
   */
  async update(session: SessionContext, id: string, input: AdvanceInput) {
    const before = await this.prisma.advancePayment.findFirst({
      where: { id, companyId: session.companyId },
      include: { allocations: true },
    });
    if (!before) throw new NotFoundException('Advance not found');
    if (before.allocations.length > 0) {
      throw new ConflictException(
        'This advance is already applied to an invoice and can no longer be edited',
      );
    }

    await this.assertCustomer(session.companyId, input.customerId);
    if (input.jobId) {
      await this.assertJobAcceptsAdvance(
        session.companyId,
        input.jobId,
        input.customerId,
      );
    }

    const receivedAt = input.receivedAt
      ? new Date(input.receivedAt)
      : before.receivedAt;

    const advance = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.advancePayment.update({
        where: { id },
        data: {
          customerId: input.customerId,
          jobId: input.jobId,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
          receivedAt,
          notes: input.notes,
        },
        include: INCLUDE,
      });

      await tx.ledgerEntry.deleteMany({ where: { advanceId: id } });
      await this.ledger.record(tx, {
        companyId: session.companyId,
        customerId: updated.customerId,
        jobId: updated.jobId,
        advanceId: updated.id,
        entryType: 'advance_received',
        amount: updated.amount,
        occurredAt: receivedAt,
        memo: `Advance ${updated.number}`,
      });

      return updated;
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'AdvancePayment',
      entityId: id,
      action: 'update',
      before,
      after: advance,
    });

    return { ...advance, unallocatedAmount: unallocatedAmount(advance) };
  }

  async remove(session: SessionContext, id: string) {
    const before = await this.prisma.advancePayment.findFirst({
      where: { id, companyId: session.companyId },
      include: { allocations: true },
    });
    if (!before) throw new NotFoundException('Advance not found');
    if (before.allocations.length > 0) {
      throw new ConflictException(
        'This advance is applied to an invoice and cannot be deleted',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Ledger rows point at the advance with onDelete: SetNull, so they have to
      // go explicitly or an orphaned credit would keep reducing the balance due.
      await tx.ledgerEntry.deleteMany({ where: { advanceId: id } });
      await tx.advancePayment.delete({ where: { id } });
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'AdvancePayment',
      entityId: id,
      action: 'delete',
      before,
    });

    return { ok: true };
  }

  private async assertCustomer(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
  }

  private async assertJobAcceptsAdvance(
    companyId: string,
    jobId: string,
    customerId: string,
  ) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, companyId },
      select: { id: true, status: true, customerId: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.customerId !== customerId) {
      throw new ConflictException('That job belongs to a different customer');
    }
    if (!canRecordAdvanceForJob(job.status as JobStatus)) {
      throw new ConflictException(
        'This job is closed and cannot take new advances',
      );
    }
  }
}
