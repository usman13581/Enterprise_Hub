import { PrismaClient } from '@prisma/client';
import {
  TEMPLATE_VERSION,
  createSampleFixture,
  countSampleSet,
} from '../src/sample-data/sample-data.fixture';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findUnique({
    where: { slug: 'binhaj-marble' },
    select: { id: true, name: true },
  });
  if (!company) {
    throw new Error('Binhaj Marble company not found. Run db:seed:pilot first.');
  }

  console.log(`Preparing generic sample data v${TEMPLATE_VERSION} for ${company.name}…`);

  await prisma.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({
      where: { companyId: company.id },
      select: { id: true },
    });
    const advances = await tx.advancePayment.findMany({
      where: { companyId: company.id },
      select: { id: true },
    });
    const purchaseInvoiceIds = (
      await tx.purchaseInvoice.findMany({
        where: { companyId: company.id },
        select: { id: true },
      })
    ).map((row) => row.id);
    const supplierPaymentIds = (
      await tx.supplierPayment.findMany({
        where: { companyId: company.id },
        select: { id: true },
      })
    ).map((row) => row.id);

    await tx.invoiceAdvanceAllocation.deleteMany({
      where: {
        OR: [
          { invoiceId: { in: invoices.map((row) => row.id) } },
          { advanceId: { in: advances.map((row) => row.id) } },
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
    await tx.supplierLedgerEntry.deleteMany({ where: { companyId: company.id } });
    await tx.supplierPriceHistory.deleteMany({ where: { companyId: company.id } });
    await tx.supplierPayment.deleteMany({ where: { companyId: company.id } });
    await tx.purchaseInvoice.deleteMany({ where: { companyId: company.id } });
    await tx.lpoReceipt.deleteMany({ where: { companyId: company.id } });
    await tx.lpo.deleteMany({ where: { companyId: company.id } });
    await tx.hRPayrollEntry.deleteMany({ where: { companyId: company.id } });
    await tx.hRPayrollPeriod.deleteMany({ where: { companyId: company.id } });
    await tx.hRLeaveRequest.deleteMany({ where: { companyId: company.id } });
    await tx.hRLeaveBalance.deleteMany({ where: { companyId: company.id } });
    await tx.hRAttendance.deleteMany({ where: { companyId: company.id } });
    await tx.hREmployee.deleteMany({ where: { companyId: company.id } });
    await tx.hRLeaveType.deleteMany({ where: { companyId: company.id } });
    await tx.hRDesignation.deleteMany({ where: { companyId: company.id } });
    await tx.hRDepartment.deleteMany({ where: { companyId: company.id } });
    await tx.hRWorkLocation.deleteMany({ where: { companyId: company.id } });
    await tx.ledgerEntry.deleteMany({ where: { companyId: company.id } });
    await tx.invoice.deleteMany({ where: { companyId: company.id } });
    await tx.advancePayment.deleteMany({ where: { companyId: company.id } });
    await tx.job.deleteMany({ where: { companyId: company.id } });
    await tx.quotation.deleteMany({ where: { companyId: company.id } });
    await tx.product.deleteMany({ where: { companyId: company.id } });
    await tx.customer.deleteMany({ where: { companyId: company.id } });
    await tx.supplier.deleteMany({ where: { companyId: company.id } });
    await tx.quotationLookup.deleteMany({ where: { companyId: company.id } });
    await tx.sampleDataSet.deleteMany({ where: { companyId: company.id } });

    const sampleSet = await tx.sampleDataSet.create({
      data: {
        companyId: company.id,
        templateKey: 'enterprise-hub-trial',
        templateVersion: TEMPLATE_VERSION,
        status: 'loaded',
      },
    });

    const metadata = await createSampleFixture(tx, company.id, sampleSet.id);
    await tx.sampleDataSet.update({
      where: { id: sampleSet.id },
      data: { metadata: metadata as object },
    });
    await tx.company.update({
      where: { id: company.id },
      data: { dataEpoch: { increment: 1 } },
    });

    const counts = await countSampleSet(tx, company.id, sampleSet.id);
    console.log('Sample data loaded:', counts);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
