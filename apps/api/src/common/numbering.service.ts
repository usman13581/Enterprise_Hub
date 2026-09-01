import { Injectable } from '@nestjs/common';
import { formatDocumentNumber, nextSequence } from '@marble/domain';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export type DocumentFamily =
  | 'quotation'
  | 'job'
  | 'invoice'
  | 'creditNote'
  | 'advance'
  | 'lpo'
  | 'purchaseInvoice'
  | 'supplierPayment';

const PREFIX_FIELD: Record<DocumentFamily, string> = {
  quotation: 'quotationPrefix',
  job: 'jobPrefix',
  invoice: 'invoicePrefix',
  creditNote: 'creditNotePrefix',
  advance: 'advancePrefix',
  lpo: 'lpoPrefix',
  purchaseInvoice: 'purchaseInvoicePrefix',
  supplierPayment: 'supplierPaymentPrefix',
};

const FALLBACK_PREFIX: Record<DocumentFamily, string> = {
  quotation: 'QT',
  job: 'JOB',
  invoice: 'INV',
  creditNote: 'CN',
  advance: 'ADV',
  lpo: 'LPO',
  purchaseInvoice: 'PINV',
  supplierPayment: 'SPAY',
};

@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Derives the next number from the highest one already stored rather than a
   * counter column, so a failed create cannot burn a number and leave a gap in
   * a sequence that a tax authority may later ask about.
   *
   * Must run inside the same transaction as the insert it numbers; the unique
   * constraint on [companyId, number] is the real guard against a race.
   */
  async next(
    tx: Prisma.TransactionClient,
    companyId: string,
    family: DocumentFamily,
  ): Promise<string> {
    const profile = await tx.companyProfile.findUnique({
      where: { companyId },
      select: { [PREFIX_FIELD[family]]: true } as never,
    });

    const prefix =
      (profile as Record<string, string> | null)?.[PREFIX_FIELD[family]] ||
      FALLBACK_PREFIX[family];

    const existing = await this.existingNumbers(tx, companyId, family, prefix);
    return formatDocumentNumber(prefix, nextSequence(existing));
  }

  private async existingNumbers(
    tx: Prisma.TransactionClient,
    companyId: string,
    family: DocumentFamily,
    prefix: string,
  ): Promise<string[]> {
    const where = { companyId, number: { startsWith: prefix } };
    const select = { number: true } as const;

    switch (family) {
      case 'quotation': {
        const rows = await tx.quotation.findMany({ where, select });
        return rows.map((row) => row.number);
      }
      case 'job': {
        const rows = await tx.job.findMany({ where, select });
        return rows.map((row) => row.number);
      }
      case 'advance': {
        const rows = await tx.advancePayment.findMany({ where, select });
        return rows.map((row) => row.number);
      }
      case 'invoice':
      case 'creditNote': {
        const rows = await tx.invoice.findMany({ where, select });
        return rows.map((row) => row.number);
      }
      case 'lpo': {
        const rows = await tx.lpo.findMany({ where, select });
        return rows.map((row) => row.number);
      }
      case 'purchaseInvoice': {
        const rows = await tx.purchaseInvoice.findMany({ where, select });
        return rows.map((row) => row.number);
      }
      case 'supplierPayment': {
        const rows = await tx.supplierPayment.findMany({ where, select });
        return rows.map((row) => row.number);
      }
    }
  }
}
