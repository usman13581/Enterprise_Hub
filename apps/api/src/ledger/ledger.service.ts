import { Injectable } from '@nestjs/common';
import {
  LEDGER_DIRECTION_BY_TYPE,
  type LedgerEntryType,
} from '@marble/types';
import { summarizeLedger, withRunningBalance } from '@marble/domain';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type LedgerWrite = {
  companyId: string;
  customerId: string;
  entryType: LedgerEntryType;
  amount: number;
  jobId?: string | null;
  invoiceId?: string | null;
  advanceId?: string | null;
  occurredAt?: Date;
  memo?: string | null;
};

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The direction is derived from the entry type rather than passed in, so a
   * caller cannot accidentally record an invoice as a credit and silently
   * corrupt every balance downstream.
   */
  record(tx: Prisma.TransactionClient, write: LedgerWrite) {
    return tx.ledgerEntry.create({
      data: {
        companyId: write.companyId,
        customerId: write.customerId,
        jobId: write.jobId ?? null,
        invoiceId: write.invoiceId ?? null,
        advanceId: write.advanceId ?? null,
        entryType: write.entryType,
        direction: LEDGER_DIRECTION_BY_TYPE[write.entryType],
        amount: write.amount,
        occurredAt: write.occurredAt ?? new Date(),
        memo: write.memo ?? null,
      },
    });
  }

  async forCustomer(companyId: string, customerId: string) {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { companyId, customerId },
      orderBy: { occurredAt: 'asc' },
    });
    return withRunningBalance(
      entries.map((entry) => ({
        ...entry,
        direction: entry.direction as 'debit' | 'credit',
      })),
    );
  }

  async forJob(companyId: string, jobId: string) {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { companyId, jobId },
      orderBy: { occurredAt: 'asc' },
    });
    return withRunningBalance(
      entries.map((entry) => ({
        ...entry,
        direction: entry.direction as 'debit' | 'credit',
      })),
    );
  }

  async summaryForCustomer(companyId: string, customerId: string) {
    const [entries, advances] = await Promise.all([
      this.prisma.ledgerEntry.findMany({ where: { companyId, customerId } }),
      this.prisma.advancePayment.findMany({ where: { companyId, customerId } }),
    ]);

    const unallocated = advances
      .filter((advance) => !advance.cancelledAt)
      .reduce(
      (total, advance) =>
        total + Math.max(0, advance.amount - advance.allocatedAmount),
      0,
    );

    return summarizeLedger(
      entries.map((entry) => ({
        ...entry,
        direction: entry.direction as 'debit' | 'credit',
      })),
      unallocated,
    );
  }

  async summaryForCompany(companyId: string) {
    const [entries, advances] = await Promise.all([
      this.prisma.ledgerEntry.findMany({ where: { companyId } }),
      this.prisma.advancePayment.findMany({ where: { companyId } }),
    ]);

    const unallocated = advances
      .filter((advance) => !advance.cancelledAt)
      .reduce(
      (total, advance) =>
        total + Math.max(0, advance.amount - advance.allocatedAmount),
      0,
    );

    return summarizeLedger(
      entries.map((entry) => ({
        ...entry,
        direction: entry.direction as 'debit' | 'credit',
      })),
      unallocated,
    );
  }
}
