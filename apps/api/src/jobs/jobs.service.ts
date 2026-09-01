import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canCloseJob,
  canCompleteJob,
  jobFinancials,
  unallocatedAmount,
} from '@marble/domain';
import type { JobStatus } from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { SessionContext } from '../auth/session.types';

const CUSTOMER_SELECT = { id: true, name: true, trn: true } as const;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  list(companyId: string, status?: JobStatus) {
    return this.prisma.job.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: CUSTOMER_SELECT },
        quotation: { select: { id: true, number: true, title: true } },
        _count: { select: { invoices: true, advances: true } },
      },
    });
  }

  async get(companyId: string, id: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: CUSTOMER_SELECT },
        quotation: {
          select: {
            id: true,
            number: true,
            title: true,
            lines: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  /** Everything the job screen shows: money story, documents, and ledger. */
  async hub(companyId: string, id: string) {
    const job = await this.get(companyId, id);

    const [invoices, advances, ledger] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { companyId, jobId: id },
        orderBy: { issueDate: 'desc' },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          allocations: true,
          customer: { select: CUSTOMER_SELECT },
        },
      }),
      this.prisma.advancePayment.findMany({
        where: { companyId, jobId: id },
        orderBy: { receivedAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true } },
          job: { select: { id: true, number: true } },
        },
      }),
      this.ledger.forJob(companyId, id),
    ]);

    const advancesApplied = invoices
      .filter((invoice) => invoice.status === 'issued')
      .reduce((total, invoice) => total + invoice.advanceApplied, 0);

    return {
      job,
      financials: jobFinancials({
        jobValue: job.jobValue,
        jobNet: job.jobNet,
        purchaseTotal: job.purchaseTotal,
        advancesApplied,
        invoices: invoices.map((invoice) => ({
          total: invoice.total,
          kind: invoice.kind,
          status: invoice.status,
        })),
      }),
      invoices,
      advances: advances.map((advance) => ({
        ...advance,
        unallocatedAmount: unallocatedAmount(advance),
      })),
      ledger,
    };
  }

  async complete(session: SessionContext, id: string) {
    const before = await this.prisma.job.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Job not found');
    if (!canCompleteJob(before.status as JobStatus)) {
      throw new ConflictException(
        `Only an open job can be completed (this one is ${before.status})`,
      );
    }

    const job = await this.prisma.job.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Job',
      entityId: id,
      action: 'complete',
      before,
      after: job,
    });

    return job;
  }

  /**
   * Closing is final in V1: it stops further invoices and advances, so it is the
   * only transition that needs the outstanding balance surfaced to the caller.
   */
  async close(session: SessionContext, id: string) {
    const before = await this.prisma.job.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Job not found');
    if (!canCloseJob(before.status as JobStatus)) {
      throw new ConflictException('This job is already closed');
    }

    const job = await this.prisma.job.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date() },
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Job',
      entityId: id,
      action: 'close',
      before,
      after: job,
    });

    return job;
  }
}
