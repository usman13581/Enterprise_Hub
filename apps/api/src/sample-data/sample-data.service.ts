import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TEMPLATE_KEY,
  TEMPLATE_VERSION,
  collectSampleRelated,
  countSampleSet,
  createSampleFixture,
  deleteSampleRelated,
} from './sample-data.fixture';

@Injectable()
export class SampleDataService {
  constructor(private readonly prisma: PrismaService) {}

  private async lock(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    companyId: string,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:${TEMPLATE_KEY}`}))`;
  }

  private async assertTrial(
    tx: PrismaService | Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    companyId: string,
  ) {
    const subscription = await tx.companySubscription.findUnique({
      where: { companyId },
      select: { status: true, expiresAt: true, trialEndsAt: true },
    });
    const trialEnd = subscription?.expiresAt ?? subscription?.trialEndsAt;
    if (
      !subscription ||
      subscription.status !== 'trial' ||
      (trialEnd && trialEnd <= new Date())
    ) {
      throw new BadRequestException(
        'Sample data is available only during an active trial.',
      );
    }
  }

  private async setFor(
    tx: PrismaService | Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    companyId: string,
  ) {
    return tx.sampleDataSet.findUnique({
      where: {
        companyId_templateKey: { companyId, templateKey: TEMPLATE_KEY },
      },
    });
  }

  async status(companyId: string) {
    const set = await this.setFor(this.prisma, companyId);
    let eligible = true;
    try {
      await this.assertTrial(this.prisma, companyId);
    } catch {
      eligible = false;
    }
    const counts =
      set?.status === 'loaded'
        ? await countSampleSet(this.prisma, companyId, set.id)
        : null;
    const versionCurrent = set?.templateVersion === TEMPLATE_VERSION;
    return {
      eligible,
      templateKey: TEMPLATE_KEY,
      templateVersion: TEMPLATE_VERSION,
      status: set?.status ?? 'not_loaded',
      counts,
      canLoad: eligible && set?.status !== 'loaded',
      canErase: eligible && set?.status === 'loaded',
      needsRefresh: set?.status === 'loaded' && !versionCurrent,
    };
  }

  async load(companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, companyId);
      await this.assertTrial(tx, companyId);
      const existing = await this.setFor(tx, companyId);
      if (
        existing?.status === 'loaded' &&
        existing.templateVersion === TEMPLATE_VERSION
      ) {
        return {
          ok: true,
          status: existing.status,
          counts: await countSampleSet(tx, companyId, existing.id),
        };
      }
      if (
        existing?.status === 'loaded' &&
        existing.templateVersion !== TEMPLATE_VERSION
      ) {
        throw new ConflictException(
          'Sample data was loaded with an older template. Erase it first, then load again.',
        );
      }

      const sampleSet = existing
        ? await tx.sampleDataSet.update({
            where: { id: existing.id },
            data: {
              status: 'loaded',
              templateVersion: TEMPLATE_VERSION,
              loadedAt: new Date(),
              erasedAt: null,
              error: null,
            },
          })
        : await tx.sampleDataSet.create({
            data: {
              companyId,
              templateKey: TEMPLATE_KEY,
              templateVersion: TEMPLATE_VERSION,
              status: 'loaded',
            },
          });

      const metadata = await createSampleFixture(tx, companyId, sampleSet.id);
      await tx.sampleDataSet.update({
        where: { id: sampleSet.id },
        data: { metadata: metadata as object },
      });
      await tx.company.update({
        where: { id: companyId },
        data: { dataEpoch: { increment: 1 } },
      });
      return {
        ok: true,
        status: sampleSet.status,
        counts: await countSampleSet(tx, companyId, sampleSet.id),
      };
    });
  }

  /** Used by pilot seed scripts — bypasses trial checks. */
  async loadDirect(companyId: string, replace = true) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, companyId);
      const existing = await this.setFor(tx, companyId);
      if (existing?.status === 'loaded' && replace) {
        const related = await collectSampleRelated(tx, companyId, existing.id);
        await deleteSampleRelated(tx, companyId, related);
        await tx.sampleDataSet.update({
          where: { id: existing.id },
          data: { status: 'erased', erasedAt: new Date() },
        });
      }

      const sampleSet = existing
        ? await tx.sampleDataSet.update({
            where: { id: existing.id },
            data: {
              status: 'loaded',
              templateVersion: TEMPLATE_VERSION,
              loadedAt: new Date(),
              erasedAt: null,
              error: null,
            },
          })
        : await tx.sampleDataSet.create({
            data: {
              companyId,
              templateKey: TEMPLATE_KEY,
              templateVersion: TEMPLATE_VERSION,
              status: 'loaded',
            },
          });

      const metadata = await createSampleFixture(tx, companyId, sampleSet.id);
      await tx.sampleDataSet.update({
        where: { id: sampleSet.id },
        data: { metadata: metadata as object },
      });
      await tx.company.update({
        where: { id: companyId },
        data: { dataEpoch: { increment: 1 } },
      });
      return {
        ok: true,
        status: sampleSet.status,
        counts: await countSampleSet(tx, companyId, sampleSet.id),
      };
    });
  }

  async purgeCompanyBusinessData(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    companyId: string,
    preserveRenewalRequestId?: string,
  ) {
    const invoices = await tx.invoice.findMany({
      where: { companyId },
      select: { id: true },
    });
    const advances = await tx.advancePayment.findMany({
      where: { companyId },
      select: { id: true },
    });
    const invoiceIds = invoices.map((row) => row.id);
    const advanceIds = advances.map((row) => row.id);
    const purchaseInvoiceIds = (
      await tx.purchaseInvoice.findMany({
        where: { companyId },
        select: { id: true },
      })
    ).map((row) => row.id);
    const supplierPaymentIds = (
      await tx.supplierPayment.findMany({
        where: { companyId },
        select: { id: true },
      })
    ).map((row) => row.id);
    const lpoIds = (
      await tx.lpo.findMany({ where: { companyId }, select: { id: true } })
    ).map((row) => row.id);

    await tx.invoiceAdvanceAllocation.deleteMany({
      where: {
        OR: [
          { invoiceId: { in: invoiceIds } },
          { advanceId: { in: advanceIds } },
        ],
      },
    });
    await tx.supplierPaymentAllocation.deleteMany({
      where: {
        OR: [
          { paymentId: { in: supplierPaymentIds } },
          { purchaseInvoiceId: { in: purchaseInvoiceIds } },
        ],
      },
    });
    await tx.supplierLedgerEntry.deleteMany({ where: { companyId } });
    await tx.supplierPriceHistory.deleteMany({ where: { companyId } });
    await tx.supplierPayment.deleteMany({ where: { companyId } });
    await tx.purchaseInvoice.deleteMany({ where: { companyId } });
    await tx.lpoReceipt.deleteMany({ where: { companyId } });
    await tx.lpo.deleteMany({ where: { companyId } });
    await tx.hRPayrollEntry.deleteMany({ where: { companyId } });
    await tx.hRPayrollPeriod.deleteMany({ where: { companyId } });
    await tx.hRLeaveRequest.deleteMany({ where: { companyId } });
    await tx.hRLeaveBalance.deleteMany({ where: { companyId } });
    await tx.hRAttendance.deleteMany({ where: { companyId } });
    await tx.hREmployee.deleteMany({ where: { companyId } });
    await tx.hRLeaveType.deleteMany({ where: { companyId } });
    await tx.hRDesignation.deleteMany({ where: { companyId } });
    await tx.hRDepartment.deleteMany({ where: { companyId } });
    await tx.hRWorkLocation.deleteMany({ where: { companyId } });
    await tx.ledgerEntry.deleteMany({ where: { companyId } });
    await tx.invoice.deleteMany({ where: { companyId } });
    await tx.advancePayment.deleteMany({ where: { companyId } });
    await tx.job.deleteMany({ where: { companyId } });
    await tx.quotation.deleteMany({ where: { companyId } });
    await tx.product.deleteMany({ where: { companyId } });
    await tx.customer.deleteMany({ where: { companyId } });
    await tx.supplier.deleteMany({ where: { companyId } });
    await tx.quotationLookup.deleteMany({ where: { companyId } });
    await tx.subscriptionRenewalRequest.deleteMany({
      where: {
        companyId,
        ...(preserveRenewalRequestId
          ? { id: { not: preserveRenewalRequestId } }
          : {}),
      },
    });
    await tx.supportRequest.deleteMany({ where: { companyId } });
    await tx.notification.deleteMany({ where: { companyId } });
    await tx.auditLog.deleteMany({ where: { companyId } });
    await tx.sampleDataSet.deleteMany({ where: { companyId } });
    await tx.company.update({
      where: { id: companyId },
      data: { dataEpoch: { increment: 1 } },
    });
  }

  async purgeTrialDataInTransaction(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    companyId: string,
    preserveRenewalRequestId?: string,
  ) {
    return this.purgeCompanyBusinessData(
      tx,
      companyId,
      preserveRenewalRequestId,
    );
  }

  async previewErase(companyId: string) {
    await this.assertTrial(this.prisma, companyId);
    const set = await this.setFor(this.prisma, companyId);
    if (!set || set.status !== 'loaded') {
      throw new NotFoundException(
        'No loaded sample data exists for this company.',
      );
    }
    return {
      templateKey: TEMPLATE_KEY,
      templateVersion: set.templateVersion,
      counts: await this.prisma.$transaction(async (tx) => {
        await this.lock(tx, companyId);
        return countSampleSet(tx, companyId, set.id);
      }),
    };
  }

  async erase(companyId: string, confirmation: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, companyId);
      await this.assertTrial(tx, companyId);
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      if (!company) throw new NotFoundException('Company not found.');
      if (confirmation !== `ERASE ${company.name}`) {
        throw new ConflictException(
          `Type ERASE ${company.name} to permanently remove trial data.`,
        );
      }
      const set = await this.setFor(tx, companyId);
      if (!set || set.status !== 'loaded') {
        throw new NotFoundException(
          'No loaded sample data exists for this company.',
        );
      }
      const related = await collectSampleRelated(tx, companyId, set.id);
      await deleteSampleRelated(tx, companyId, related);
      await tx.company.update({
        where: { id: companyId },
        data: { dataEpoch: { increment: 1 } },
      });
      await tx.sampleDataSet.update({
        where: { id: set.id },
        data: { status: 'erased', erasedAt: new Date(), error: null },
      });
      return {
        ok: true,
        status: 'erased',
        counts: {
          suppliers: related.supplierIds.length,
          products: related.productIds.length,
          customers: related.customerIds.length,
          quotations: related.quoteIds.length,
          jobs: related.jobIds.length,
          invoices: related.invoiceIds.length,
          advances: related.advanceIds.length,
          lpos: related.lpoIds.length,
          purchaseInvoices: related.purchaseInvoiceIds.length,
          supplierPayments: related.supplierPaymentIds.length,
          hrEmployees: related.hrEmployeeIds.length,
        },
      };
    });
  }
}
