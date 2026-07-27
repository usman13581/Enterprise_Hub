import { Injectable } from '@nestjs/common';
import { roundMoney } from '@marble/domain';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Company-level money view: what is owed, what is held as advances, and the
   * margin on each job. Margin uses the purchase/sell prices captured on the
   * job at approval, so re-pricing the catalog never rewrites history.
   */
  async overview(companyId: string) {
    const [summary, entries, jobs] = await Promise.all([
      this.ledger.summaryForCompany(companyId),
      this.prisma.ledgerEntry.findMany({
        where: { companyId },
        include: { customer: { select: { id: true, name: true } } },
      }),
      this.prisma.job.findMany({
        where: { companyId },
        include: {
          customer: { select: { id: true, name: true } },
          quotation: { select: { number: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const byCustomer = new Map<
      string,
      { customerId: string; customerName: string; billed: number; received: number }
    >();

    for (const entry of entries) {
      const row = byCustomer.get(entry.customerId) ?? {
        customerId: entry.customerId,
        customerName: entry.customer.name,
        billed: 0,
        received: 0,
      };
      if (entry.direction === 'debit') row.billed += entry.amount;
      else row.received += entry.amount;
      byCustomer.set(entry.customerId, row);
    }

    const receivableByCustomer = [...byCustomer.values()]
      .map((row) => ({
        ...row,
        billed: roundMoney(row.billed),
        received: roundMoney(row.received),
        balance: roundMoney(row.billed - row.received),
      }))
      .sort((a, b) => b.balance - a.balance);

    const profitByJob = jobs.map((job) => ({
      jobId: job.id,
      jobNumber: job.number,
      quotationNumber: job.quotation?.number ?? null,
      customerName: job.customer.name,
      jobValue: roundMoney(job.jobValue),
      purchaseTotal: roundMoney(job.purchaseTotal),
      profit: roundMoney(job.jobNet - job.purchaseTotal),
      status: job.status,
    }));

    return {
      summary,
      receivableByCustomer,
      profitByJob,
      openJobs: jobs.filter((job) => job.status === 'open').length,
      totalProfit: roundMoney(
        profitByJob.reduce((total, job) => total + job.profit, 0),
      ),
    };
  }

  customerLedger(companyId: string, customerId: string) {
    return this.ledger.forCustomer(companyId, customerId);
  }

  jobLedger(companyId: string, jobId: string) {
    return this.ledger.forJob(companyId, jobId);
  }
}
