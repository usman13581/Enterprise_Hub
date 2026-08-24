import { Injectable, NotFoundException } from '@nestjs/common';
import { roundMoney, unallocatedAmount } from '@marble/domain';
import type { CustomerInput } from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { SessionContext } from '../auth/session.types';

export type { CustomerInput };

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  list(companyId: string) {
    return this.prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async get(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /**
   * The customer cockpit the plan calls critical: receivable position, advances,
   * a per-job breakdown of where that money sits, and the full document trail.
   */
  async hub(companyId: string, id: string) {
    const customer = await this.get(companyId, id);

    const [summary, quotations, jobs, invoices, advances, ledger] =
      await Promise.all([
        this.ledger.summaryForCustomer(companyId, id),
        this.prisma.quotation.findMany({
          where: { companyId, customerId: id },
          orderBy: { createdAt: 'desc' },
          include: {
            lines: { orderBy: { sortOrder: 'asc' } },
            job: { select: { id: true, number: true, status: true } },
          },
        }),
        this.prisma.job.findMany({
          where: { companyId, customerId: id },
          orderBy: { createdAt: 'desc' },
          include: { quotation: { select: { id: true, number: true, title: true } } },
        }),
        this.prisma.invoice.findMany({
          where: { companyId, customerId: id },
          orderBy: { issueDate: 'desc' },
          include: {
            lines: { orderBy: { sortOrder: 'asc' } },
            allocations: true,
            job: { select: { id: true, number: true, status: true } },
          },
        }),
        this.prisma.advancePayment.findMany({
          where: { companyId, customerId: id },
          orderBy: { receivedAt: 'desc' },
          include: { job: { select: { id: true, number: true } } },
        }),
        this.ledger.forCustomer(companyId, id),
      ]);

    const byJob = jobs.map((job) => {
      const jobInvoices = invoices.filter(
        (invoice) => invoice.jobId === job.id && invoice.status !== 'cancelled',
      );
      const invoiced = jobInvoices.reduce(
        (total, invoice) =>
          total +
          (invoice.kind === 'credit_note' ? -invoice.total : invoice.total),
        0,
      );
      const jobAdvances = advances
        .filter((advance) => advance.jobId === job.id)
        .reduce((total, advance) => total + advance.amount, 0);

      return {
        jobId: job.id,
        jobNumber: job.number,
        quotationNumber: job.quotation?.number ?? null,
        status: job.status,
        jobValue: roundMoney(job.jobValue),
        invoiced: roundMoney(invoiced),
        advances: roundMoney(jobAdvances),
        balance: roundMoney(invoiced - jobAdvances),
      };
    });

    return {
      customer,
      summary,
      byJob,
      quotations,
      jobs,
      invoices,
      advances: advances.map((advance) => ({
        ...advance,
        unallocatedAmount: unallocatedAmount(advance),
      })),
      ledger,
    };
  }

  async create(session: SessionContext, input: CustomerInput) {
    const customer = await this.prisma.customer.create({
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
      entityType: 'Customer',
      entityId: customer.id,
      action: 'create',
      after: customer,
    });

    return customer;
  }

  async update(session: SessionContext, id: string, input: CustomerInput) {
    const before = await this.prisma.customer.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Customer not found');

    const customer = await this.prisma.customer.update({
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
      entityType: 'Customer',
      entityId: id,
      action: 'update',
      before,
      after: customer,
    });

    return customer;
  }

  async remove(session: SessionContext, id: string) {
    const before = await this.prisma.customer.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Customer not found');

    const customer = await this.prisma.customer.update({
      where: { id },
      data: { active: false },
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Customer',
      entityId: id,
      action: 'deactivate',
      before,
      after: customer,
    });

    return { ok: true };
  }
}
