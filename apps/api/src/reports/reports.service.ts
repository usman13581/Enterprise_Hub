import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AGING_BUCKET_LABELS,
  ageReceivables,
  customerStatement,
  defaultAsOf,
  defaultReportFrom,
  defaultReportTo,
  endOfUtcDay,
  jobFinancials,
  parseReportDate,
  roundMoney,
  startOfUtcDay,
  toFils,
  fromFils,
  unallocatedAmount,
} from '@marble/domain';
import {
  INVOICE_REPORT_VIEWS,
  REPORT_NAV,
  type InvoiceReportView,
  type ReportKey,
} from '@marble/types';
import { renderReportPdf, type PdfCompany } from '@marble/pdf';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportQuery, ReportResult } from './report.types';

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dayLabel(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function moneyCols(
  keys: Array<[string, string]>,
): ReportResult['columns'] {
  return keys.map(([key, label]) => ({
    key,
    label,
    align: 'right' as const,
    money: true,
  }));
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  shell() {
    return {
      reports: REPORT_NAV.map((r) => ({
        key: r.key,
        label: r.label,
        description: r.description,
        params: [...r.params],
        href: `/reports/${r.key}`,
      })),
      invoiceViews: INVOICE_REPORT_VIEWS.map((v) => ({
        key: v.key,
        label: v.label,
        description: v.description,
        href: `/reports/invoices/${v.key}`,
      })),
    };
  }

  async run(companyId: string, key: string, query: ReportQuery) {
    const reportKey = this.assertReportKey(key);
    switch (reportKey) {
      case 'customer-statement':
        return this.customerStatement(companyId, query);
      case 'customer-balances':
        return this.customerBalances(companyId, query);
      case 'aged-receivables':
        return this.agedReceivables(companyId, query);
      case 'job-costing':
        return this.jobCosting(companyId, query);
      case 'customer-margin':
        return this.customerMargin(companyId, query);
      case 'monthly-pnl':
        return this.monthlyPnl(companyId, query);
      case 'advances-register':
        return this.advancesRegister(companyId, query);
      case 'unallocated-advances':
        return this.unallocatedAdvances(companyId, query);
      case 'unbilled':
        return this.unbilled(companyId, query);
      case 'allocation-rec':
        return this.allocationRec(companyId, query);
      case 'supplier-product-register':
        return this.supplierProductRegister(companyId, query);
      case 'supplier-cost-summary':
        return this.supplierCostSummary(companyId, query);
      case 'supplier-quotation-usage':
        return this.supplierQuotationUsage(companyId, query);
      case 'supplier-job-costing':
        return this.supplierJobCosting(companyId, query);
      case 'supplier-statement':
      case 'aged-payables':
      case 'purchase-invoice-register':
      case 'supplier-payment-register':
      case 'lpo-register':
      case 'supplier-spend':
      case 'supplier-price-history':
      case 'input-vat-summary':
        return this.supplierAccounting(companyId, reportKey, query);
      default:
        throw new BadRequestException(`Unknown report ${key}`);
    }
  }

  async runInvoice(companyId: string, view: string, query: ReportQuery) {
    const invoiceView = this.assertInvoiceView(view);
    return this.invoiceReport(companyId, invoiceView, query);
  }

  async pdf(companyId: string, key: string, query: ReportQuery) {
    const result = await this.run(companyId, key, query);
    return this.render(companyId, result);
  }

  async invoicePdf(companyId: string, view: string, query: ReportQuery) {
    const result = await this.runInvoice(companyId, view, query);
    return this.render(companyId, result);
  }

  private async render(companyId: string, result: ReportResult) {
    const company = await this.company(companyId);
    const meta = Object.entries(result.params)
      .filter(([, value]) => value)
      .map(([label, value]) => [label, value!] as [string, string]);

    const buffer = await renderReportPdf({
      company,
      title: result.title,
      subtitle: result.key,
      meta,
      summary: result.summary,
      columns: result.columns,
      rows: result.rows,
      footerNote: result.footerNote ?? null,
    });

    return {
      buffer,
      filename: `${result.key}-${isoDate(new Date())}.pdf`,
    };
  }

  private assertReportKey(key: string): ReportKey {
    if (!REPORT_NAV.some((r) => r.key === key)) {
      throw new NotFoundException(`Report not found: ${key}`);
    }
    return key as ReportKey;
  }

  private assertInvoiceView(view: string): InvoiceReportView {
    if (!INVOICE_REPORT_VIEWS.some((v) => v.key === view)) {
      throw new NotFoundException(`Invoice report view not found: ${view}`);
    }
    return view as InvoiceReportView;
  }

  private period(query: ReportQuery) {
    const from = startOfUtcDay(
      parseReportDate(query.from, defaultReportFrom()),
    );
    const to = endOfUtcDay(parseReportDate(query.to, defaultReportTo()));
    return { from, to };
  }

  private asOf(query: ReportQuery) {
    return endOfUtcDay(parseReportDate(query.asOf, defaultAsOf()));
  }

  private async customerStatement(
    companyId: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    if (!query.customerId) {
      throw new BadRequestException('customerId is required');
    }
    const { from, to } = this.period(query);
    const customer = await this.prisma.customer.findFirst({
      where: { id: query.customerId, companyId },
      select: { id: true, name: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const [entries, advances] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { companyId, customerId: customer.id },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.advancePayment.findMany({
        where: {
          companyId,
          customerId: customer.id,
          cancelledAt: null,
          ...(query.jobId ? { jobId: query.jobId } : {}),
        },
      }),
    ]);

    const unallocated = advances.reduce(
      (total, advance) => total + unallocatedAmount(advance),
      0,
    );

    const statement = customerStatement({
      entries: entries.map((entry) => ({
        ...entry,
        direction: entry.direction as 'debit' | 'credit',
      })),
      from,
      to,
      jobId: query.jobId,
      unallocatedAdvances: unallocated,
    });

    return {
      key: 'customer-statement',
      title: `Statement — ${customer.name}`,
      params: {
        from: isoDate(from),
        to: isoDate(to),
        customerId: customer.id,
        customerName: customer.name,
        jobId: query.jobId ?? null,
      },
      summary: [
        { label: 'Opening', value: statement.openingBalance, money: true },
        {
          label: 'Billed (period)',
          value: statement.periodSummary.billed,
          money: true,
        },
        {
          label: 'Received (period)',
          value: statement.periodSummary.advancesReceived,
          money: true,
        },
        { label: 'Closing', value: statement.closingBalance, money: true },
        {
          label: 'Unallocated advances',
          value: roundMoney(unallocated),
          money: true,
        },
      ],
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'type', label: 'Type' },
        { key: 'memo', label: 'Memo' },
        { key: 'debit', label: 'Debit', align: 'right', money: true },
        { key: 'credit', label: 'Credit', align: 'right', money: true },
        { key: 'balance', label: 'Balance', align: 'right', money: true },
      ],
      rows: statement.movements.map((entry) => ({
        date: dayLabel(entry.occurredAt),
        type: entry.entryType,
        memo: entry.memo ?? '',
        debit: entry.direction === 'debit' ? entry.amount : null,
        credit: entry.direction === 'credit' ? entry.amount : null,
        balance: entry.runningBalance,
      })),
      footerNote: `Closing balance ${roundMoney(statement.closingBalance).toFixed(2)} AED`,
    };
  }

  private async customerBalances(
    companyId: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    const asOf = this.asOf(query);
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        companyId,
        occurredAt: { lte: asOf },
        ...(query.customerId ? { customerId: query.customerId } : {}),
      },
      include: { customer: { select: { id: true, name: true } } },
    });

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

    const rows = [...byCustomer.values()]
      .map((row) => ({
        customerId: row.customerId,
        customer: row.customerName,
        billed: roundMoney(row.billed),
        received: roundMoney(row.received),
        balance: roundMoney(row.billed - row.received),
      }))
      .sort((a, b) => b.balance - a.balance);

    const companyAr = roundMoney(
      rows.reduce((total, row) => total + row.balance, 0),
    );

    return {
      key: 'customer-balances',
      title: 'Customer balances',
      params: {
        asOf: isoDate(asOf),
        customerId: query.customerId ?? null,
      },
      summary: [
        { label: 'Customers', value: rows.length },
        {
          label: 'Total billed',
          value: roundMoney(rows.reduce((t, r) => t + r.billed, 0)),
          money: true,
        },
        {
          label: 'Total received',
          value: roundMoney(rows.reduce((t, r) => t + r.received, 0)),
          money: true,
        },
        { label: 'Company AR', value: companyAr, money: true },
      ],
      columns: [
        { key: 'customer', label: 'Customer' },
        ...moneyCols([
          ['billed', 'Billed'],
          ['received', 'Received'],
          ['balance', 'Balance due'],
        ]),
      ],
      rows,
      footerNote: `Sum of balances = company AR ${companyAr.toFixed(2)} AED`,
    };
  }

  private async agedReceivables(
    companyId: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    const asOf = this.asOf(query);
    const [invoices, advances] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          companyId,
          status: 'issued',
          kind: { not: 'credit_note' },
          issueDate: { lte: asOf },
          ...(query.customerId ? { customerId: query.customerId } : {}),
        },
        include: {
          customer: { select: { id: true, name: true } },
          job: { select: { number: true } },
        },
      }),
      this.prisma.advancePayment.findMany({
        where: {
          companyId,
          cancelledAt: null,
          receivedAt: { lte: asOf },
          ...(query.customerId ? { customerId: query.customerId } : {}),
        },
      }),
    ]);

    const aged = ageReceivables({
      invoices: invoices
        .filter((invoice) => invoice.netPayable > 0)
        .map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          customerId: invoice.customerId,
          customerName: invoice.customer.name,
          jobId: invoice.jobId,
          jobNumber: invoice.job?.number ?? null,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          netPayable: invoice.netPayable,
          advanceApplied: invoice.advanceApplied,
        })),
      advances,
      asOf,
    });

    return {
      key: 'aged-receivables',
      title: 'Aged receivables',
      params: {
        asOf: isoDate(asOf),
        customerId: query.customerId ?? null,
      },
      summary: [
        { label: 'Outstanding', value: aged.totals.outstanding, money: true },
        { label: 'Current', value: aged.totals.current, money: true },
        { label: '1–30', value: aged.totals.days1to30, money: true },
        { label: '31–60', value: aged.totals.days31to60, money: true },
        { label: '61–90', value: aged.totals.days61to90, money: true },
        { label: '90+', value: aged.totals.days90plus, money: true },
      ],
      columns: [
        { key: 'number', label: 'Invoice' },
        { key: 'customer', label: 'Customer' },
        { key: 'job', label: 'Job' },
        { key: 'dueDate', label: 'Due' },
        { key: 'bucket', label: 'Bucket' },
        {
          key: 'outstanding',
          label: 'Outstanding',
          align: 'right',
          money: true,
        },
      ],
      rows: aged.rows.map((row) => ({
        number: row.number,
        customer: row.customerName,
        job: row.jobNumber ?? '—',
        dueDate: dayLabel(row.dueDate ?? row.issueDate),
        bucket: AGING_BUCKET_LABELS[row.bucket],
        outstanding: row.outstanding,
      })),
      footerNote: `Outstanding after FIFO advances = ${aged.totals.outstanding.toFixed(2)} AED`,
    };
  }

  private async jobCosting(
    companyId: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    if (!query.jobId) {
      throw new BadRequestException('jobId is required');
    }
    const job = await this.prisma.job.findFirst({
      where: { id: query.jobId, companyId },
      include: {
        customer: { select: { name: true } },
        invoices: {
          select: {
            total: true,
            kind: true,
            status: true,
            advanceApplied: true,
            number: true,
            issueDate: true,
          },
        },
      },
    });
    if (!job) throw new NotFoundException('Job not found');

    const advancesApplied = job.invoices
      .filter((invoice) => invoice.status !== 'cancelled')
      .reduce((total, invoice) => total + invoice.advanceApplied, 0);

    const financials = jobFinancials({
      jobValue: job.jobValue,
      jobNet: job.jobNet,
      invoices: job.invoices,
      advancesApplied,
      purchaseTotal: job.purchaseTotal,
    });

    return {
      key: 'job-costing',
      title: `Job costing — ${job.number}`,
      params: {
        jobId: job.id,
        jobNumber: job.number,
        customer: job.customer.name,
      },
      summary: [
        { label: 'Job value', value: financials.jobValue, money: true },
        {
          label: 'Invoiced to date',
          value: financials.invoicedToDate,
          money: true,
        },
        {
          label: 'Remaining',
          value: financials.balanceRemaining,
          money: true,
        },
        { label: 'Cost', value: financials.purchaseTotal, money: true },
        { label: 'Planned margin', value: financials.profit, money: true },
      ],
      columns: [
        { key: 'number', label: 'Invoice' },
        { key: 'kind', label: 'Kind' },
        { key: 'status', label: 'Status' },
        { key: 'issueDate', label: 'Issue date' },
        { key: 'total', label: 'Gross', align: 'right', money: true },
        {
          key: 'advanceApplied',
          label: 'Advance',
          align: 'right',
          money: true,
        },
      ],
      rows: job.invoices.map((invoice) => ({
        number: invoice.number,
        kind: invoice.kind,
        status: invoice.status,
        issueDate: dayLabel(invoice.issueDate),
        total: invoice.total,
        advanceApplied: invoice.advanceApplied,
      })),
      footerNote: `Planned margin ${financials.profit.toFixed(2)} AED (job net − cost)`,
    };
  }

  private async customerMargin(
    companyId: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    const { from, to } = this.period(query);
    const jobs = await this.prisma.job.findMany({
      where: {
        companyId,
        ...(query.customerId ? { customerId: query.customerId } : {}),
        createdAt: { lte: to },
      },
      include: {
        customer: { select: { id: true, name: true } },
        invoices: {
          select: { total: true, kind: true, status: true, advanceApplied: true },
        },
      },
    });

    const byCustomer = new Map<
      string,
      {
        customer: string;
        jobs: number;
        jobValue: number;
        invoiced: number;
        cost: number;
        margin: number;
      }
    >();

    for (const job of jobs) {
      // Optional period filter on completedAt when from is set: include open jobs always.
      if (query.from || query.to) {
        const inPeriod =
          !job.completedAt ||
          (job.completedAt >= from && job.completedAt <= to) ||
          (job.createdAt >= from && job.createdAt <= to);
        if (!inPeriod && job.status !== 'open') continue;
      }

      const advancesApplied = job.invoices
        .filter((invoice) => invoice.status !== 'cancelled')
        .reduce((total, invoice) => total + invoice.advanceApplied, 0);
      const financials = jobFinancials({
        jobValue: job.jobValue,
        jobNet: job.jobNet,
        invoices: job.invoices,
        advancesApplied,
        purchaseTotal: job.purchaseTotal,
      });

      const row = byCustomer.get(job.customerId) ?? {
        customer: job.customer.name,
        jobs: 0,
        jobValue: 0,
        invoiced: 0,
        cost: 0,
        margin: 0,
      };
      row.jobs += 1;
      row.jobValue += financials.jobValue;
      row.invoiced += financials.invoicedToDate;
      row.cost += financials.purchaseTotal;
      row.margin += financials.profit;
      byCustomer.set(job.customerId, row);
    }

    const rows = [...byCustomer.values()]
      .map((row) => ({
        customer: row.customer,
        jobs: row.jobs,
        jobValue: roundMoney(row.jobValue),
        invoiced: roundMoney(row.invoiced),
        cost: roundMoney(row.cost),
        margin: roundMoney(row.margin),
      }))
      .sort((a, b) => b.margin - a.margin);

    const totalMargin = roundMoney(rows.reduce((t, r) => t + r.margin, 0));

    return {
      key: 'customer-margin',
      title: 'Customer-wise margin',
      params: {
        from: isoDate(from),
        to: isoDate(to),
        customerId: query.customerId ?? null,
      },
      summary: [
        { label: 'Customers', value: rows.length },
        {
          label: 'Job value',
          value: roundMoney(rows.reduce((t, r) => t + r.jobValue, 0)),
          money: true,
        },
        {
          label: 'Cost',
          value: roundMoney(rows.reduce((t, r) => t + r.cost, 0)),
          money: true,
        },
        { label: 'Planned margin', value: totalMargin, money: true },
      ],
      columns: [
        { key: 'customer', label: 'Customer' },
        { key: 'jobs', label: 'Jobs', align: 'right' },
        ...moneyCols([
          ['jobValue', 'Job value'],
          ['invoiced', 'Invoiced'],
          ['cost', 'Cost'],
          ['margin', 'Margin'],
        ]),
      ],
      rows,
      footerNote: `Total planned margin ${totalMargin.toFixed(2)} AED`,
    };
  }

  private async monthlyPnl(
    companyId: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    const { from, to } = this.period(query);
    const [invoices, jobs] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          companyId,
          status: 'issued',
          issueDate: { gte: from, lte: to },
        },
      }),
      this.prisma.job.findMany({
        where: {
          companyId,
          completedAt: { gte: from, lte: to },
        },
      }),
    ]);

    let taxableFils = 0;
    let vatFils = 0;
    let grossFils = 0;
    let creditGrossFils = 0;

    for (const invoice of invoices) {
      const sign = invoice.kind === 'credit_note' ? -1 : 1;
      taxableFils += sign * toFils(invoice.subtotal);
      vatFils += sign * toFils(invoice.vatAmount);
      if (invoice.kind === 'credit_note') {
        creditGrossFils += toFils(invoice.total);
      } else {
        grossFils += toFils(invoice.total);
      }
    }

    const completedMargin = roundMoney(
      jobs.reduce(
        (total, job) => total + (job.jobNet - job.purchaseTotal),
        0,
      ),
    );

    const invoicedNet = fromFils(taxableFils);

    return {
      key: 'monthly-pnl',
      title: 'Monthly P&L',
      params: { from: isoDate(from), to: isoDate(to) },
      summary: [
        { label: 'Invoiced (taxable)', value: invoicedNet, money: true },
        { label: 'VAT', value: fromFils(vatFils), money: true },
        {
          label: 'Gross billed',
          value: fromFils(grossFils - creditGrossFils),
          money: true,
        },
        {
          label: 'Jobs completed',
          value: jobs.length,
        },
        {
          label: 'Completed-job profit',
          value: completedMargin,
          money: true,
        },
      ],
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'amount', label: 'Amount', align: 'right', money: true },
        { key: 'note', label: 'Note' },
      ],
      rows: [
        {
          metric: 'Invoiced net (ex VAT)',
          amount: invoicedNet,
          note: 'Issued invoices − credit notes',
        },
        {
          metric: 'Output VAT',
          amount: fromFils(vatFils),
          note: 'Collected VAT (owed onward)',
        },
        {
          metric: 'Completed-job profit',
          amount: completedMargin,
          note: 'jobNet − purchaseTotal for jobs completed in period',
        },
      ],
      footerNote:
        'Cash collected is not profit. Completed-job profit uses jobs completed in the period.',
    };
  }

  private async advancesRegister(
    companyId: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    const { from, to } = this.period(query);
    const advances = await this.prisma.advancePayment.findMany({
      where: {
        companyId,
        receivedAt: { gte: from, lte: to },
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.jobId ? { jobId: query.jobId } : {}),
      },
      include: {
        customer: { select: { name: true } },
        job: { select: { number: true } },
      },
      orderBy: { receivedAt: 'asc' },
    });

    const rows = advances.map((advance) => {
      const leftover = unallocatedAmount(advance);
      return {
        number: advance.number,
        customer: advance.customer.name,
        job: advance.job?.number ?? '—',
        receivedAt: dayLabel(advance.receivedAt),
        method: advance.method,
        reference: advance.reference ?? '',
        amount: roundMoney(advance.amount),
        allocated: roundMoney(advance.allocatedAmount),
        unallocated: roundMoney(leftover),
        status: advance.cancelledAt ? 'cancelled' : 'active',
      };
    });

    const active = rows.filter((row) => row.status === 'active');
    const totalAmount = roundMoney(
      active.reduce((t, r) => t + r.amount, 0),
    );
    const totalUnallocated = roundMoney(
      active.reduce((t, r) => t + r.unallocated, 0),
    );

    return {
      key: 'advances-register',
      title: 'Advances register',
      params: {
        from: isoDate(from),
        to: isoDate(to),
        customerId: query.customerId ?? null,
        jobId: query.jobId ?? null,
      },
      summary: [
        { label: 'Receipts', value: active.length },
        { label: 'Received', value: totalAmount, money: true },
        {
          label: 'Allocated',
          value: roundMoney(active.reduce((t, r) => t + r.allocated, 0)),
          money: true,
        },
        { label: 'Unallocated', value: totalUnallocated, money: true },
      ],
      columns: [
        { key: 'number', label: 'Number' },
        { key: 'customer', label: 'Customer' },
        { key: 'job', label: 'Job' },
        { key: 'receivedAt', label: 'Received' },
        { key: 'method', label: 'Method' },
        { key: 'reference', label: 'Reference' },
        ...moneyCols([
          ['amount', 'Amount'],
          ['allocated', 'Allocated'],
          ['unallocated', 'Leftover'],
        ]),
      ],
      rows,
      footerNote: `Unallocated on register ${totalUnallocated.toFixed(2)} AED`,
    };
  }

  private async unallocatedAdvances(
    companyId: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    const asOf = this.asOf(query);
    const advances = await this.prisma.advancePayment.findMany({
      where: {
        companyId,
        cancelledAt: null,
        receivedAt: { lte: asOf },
        ...(query.customerId ? { customerId: query.customerId } : {}),
      },
      include: {
        customer: { select: { name: true } },
        job: { select: { number: true } },
      },
      orderBy: { receivedAt: 'asc' },
    });

    const rows = advances
      .map((advance) => ({
        number: advance.number,
        customer: advance.customer.name,
        job: advance.job?.number ?? '—',
        receivedAt: dayLabel(advance.receivedAt),
        amount: roundMoney(advance.amount),
        allocated: roundMoney(advance.allocatedAmount),
        unallocated: roundMoney(unallocatedAmount(advance)),
      }))
      .filter((row) => row.unallocated > 0);

    const total = roundMoney(rows.reduce((t, r) => t + r.unallocated, 0));

    return {
      key: 'unallocated-advances',
      title: 'Unallocated advances',
      params: {
        asOf: isoDate(asOf),
        customerId: query.customerId ?? null,
      },
      summary: [
        { label: 'Advances', value: rows.length },
        { label: 'Held on account', value: total, money: true },
      ],
      columns: [
        { key: 'number', label: 'Number' },
        { key: 'customer', label: 'Customer' },
        { key: 'job', label: 'Job' },
        { key: 'receivedAt', label: 'Received' },
        ...moneyCols([
          ['amount', 'Amount'],
          ['allocated', 'Allocated'],
          ['unallocated', 'On account'],
        ]),
      ],
      rows,
      footerNote: `Money held on account ${total.toFixed(2)} AED`,
    };
  }

  private async unbilled(
    companyId: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    const asOf = this.asOf(query);
    const jobs = await this.prisma.job.findMany({
      where: {
        companyId,
        createdAt: { lte: asOf },
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.jobId ? { id: query.jobId } : {}),
        status: { not: 'closed' },
      },
      include: {
        customer: { select: { name: true } },
        invoices: {
          where: { issueDate: { lte: asOf } },
          select: {
            total: true,
            kind: true,
            status: true,
            advanceApplied: true,
          },
        },
      },
      orderBy: { number: 'asc' },
    });

    const rows = jobs.map((job) => {
      const advancesApplied = job.invoices
        .filter((invoice) => invoice.status !== 'cancelled')
        .reduce((total, invoice) => total + invoice.advanceApplied, 0);
      const financials = jobFinancials({
        jobValue: job.jobValue,
        jobNet: job.jobNet,
        invoices: job.invoices,
        advancesApplied,
        purchaseTotal: job.purchaseTotal,
      });
      return {
        job: job.number,
        customer: job.customer.name,
        status: job.status,
        jobValue: financials.jobValue,
        invoiced: financials.invoicedToDate,
        remaining: financials.balanceRemaining,
      };
    });

    const remaining = roundMoney(rows.reduce((t, r) => t + r.remaining, 0));

    return {
      key: 'unbilled',
      title: 'Billing progress / unbilled',
      params: {
        asOf: isoDate(asOf),
        customerId: query.customerId ?? null,
        jobId: query.jobId ?? null,
      },
      summary: [
        { label: 'Jobs', value: rows.length },
        {
          label: 'Job value',
          value: roundMoney(rows.reduce((t, r) => t + r.jobValue, 0)),
          money: true,
        },
        {
          label: 'Invoiced',
          value: roundMoney(rows.reduce((t, r) => t + r.invoiced, 0)),
          money: true,
        },
        { label: 'Unbilled', value: remaining, money: true },
      ],
      columns: [
        { key: 'job', label: 'Job' },
        { key: 'customer', label: 'Customer' },
        { key: 'status', label: 'Status' },
        ...moneyCols([
          ['jobValue', 'Job value'],
          ['invoiced', 'Invoiced'],
          ['remaining', 'Remaining'],
        ]),
      ],
      rows,
      footerNote: `Unbilled remaining ${remaining.toFixed(2)} AED`,
    };
  }

  private async allocationRec(
    companyId: string,
    query: ReportQuery,
  ): Promise<ReportResult> {
    const { from, to } = this.period(query);
    const [advances, allocations] = await Promise.all([
      this.prisma.advancePayment.findMany({
        where: {
          companyId,
          receivedAt: { gte: from, lte: to },
          ...(query.customerId ? { customerId: query.customerId } : {}),
        },
        include: { customer: { select: { name: true } } },
      }),
      this.prisma.invoiceAdvanceAllocation.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          invoice: {
            companyId,
            ...(query.customerId ? { customerId: query.customerId } : {}),
          },
        },
        include: {
          invoice: { select: { number: true, advanceApplied: true } },
          advance: { select: { number: true } },
        },
      }),
    ]);

    const advanceRows = advances.map((advance) => ({
      side: 'advance',
      number: advance.number,
      customer: advance.customer.name,
      amount: roundMoney(advance.amount),
      allocated: roundMoney(advance.allocatedAmount),
      leftover: roundMoney(unallocatedAmount(advance)),
      check: roundMoney(
        advance.amount - advance.allocatedAmount - unallocatedAmount(advance),
      ),
    }));

    const invoiceMap = new Map<
      string,
      { number: string; applied: number; allocatedSum: number }
    >();
    for (const allocation of allocations) {
      const row = invoiceMap.get(allocation.invoiceId) ?? {
        number: allocation.invoice.number,
        applied: allocation.invoice.advanceApplied,
        allocatedSum: 0,
      };
      row.allocatedSum += allocation.amount;
      invoiceMap.set(allocation.invoiceId, row);
    }

    const invoiceRows = [...invoiceMap.values()].map((row) => ({
      side: 'invoice',
      number: row.number,
      customer: '',
      amount: roundMoney(row.applied),
      allocated: roundMoney(row.allocatedSum),
      leftover: 0,
      check: roundMoney(row.applied - row.allocatedSum),
    }));

    const rows = [...advanceRows, ...invoiceRows];
    const broken = rows.filter((row) => Math.abs(row.check) > 0.009).length;

    return {
      key: 'allocation-rec',
      title: 'Advance allocation reconciliation',
      params: {
        from: isoDate(from),
        to: isoDate(to),
        customerId: query.customerId ?? null,
      },
      summary: [
        { label: 'Advance rows', value: advanceRows.length },
        { label: 'Invoice rows', value: invoiceRows.length },
        { label: 'Mismatches', value: broken },
      ],
      columns: [
        { key: 'side', label: 'Side' },
        { key: 'number', label: 'Number' },
        { key: 'customer', label: 'Customer' },
        ...moneyCols([
          ['amount', 'Amount / applied'],
          ['allocated', 'Allocated / sum'],
          ['leftover', 'Leftover'],
          ['check', 'Diff'],
        ]),
      ],
      rows,
      footerNote:
        broken === 0
          ? 'Advance = allocated + leftover; invoice applied = sum of allocations'
          : `${broken} row(s) do not reconcile`,
    };
  }

  private async invoiceReport(
    companyId: string,
    view: InvoiceReportView,
    query: ReportQuery,
  ): Promise<ReportResult> {
    const { from, to } = this.period(query);
    const asOf = this.asOf(query);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        issueDate: { gte: from, lte: to },
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.jobId ? { jobId: query.jobId } : {}),
        ...(query.kind && query.kind !== 'all' ? { kind: query.kind } : {}),
        ...(query.status && query.status !== 'all'
          ? { status: query.status }
          : {}),
      },
      include: {
        customer: { select: { name: true, trn: true } },
        job: { select: { number: true } },
        creditNoteFor: { select: { number: true } },
        allocations: {
          include: {
            advance: { select: { number: true, receivedAt: true } },
          },
        },
      },
      orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
    });

    const masterColumns: ReportResult['columns'] = [
      { key: 'number', label: 'Number' },
      { key: 'kind', label: 'Kind' },
      { key: 'status', label: 'Status' },
      { key: 'customer', label: 'Customer' },
      { key: 'job', label: 'Job' },
      { key: 'issueDate', label: 'Issue' },
      { key: 'dueDate', label: 'Due' },
      ...moneyCols([
        ['taxable', 'Taxable'],
        ['vat', 'VAT'],
        ['gross', 'Gross'],
        ['advanceApplied', 'Advance'],
        ['netPayable', 'Net payable'],
      ]),
    ];

    const toMasterRow = (invoice: (typeof invoices)[number]) => ({
      number: invoice.number,
      kind: invoice.kind,
      status: invoice.status,
      customer: invoice.customer.name,
      job: invoice.job?.number ?? '—',
      issueDate: dayLabel(invoice.issueDate),
      dueDate: dayLabel(invoice.dueDate),
      taxable: invoice.subtotal,
      vat: invoice.vatAmount,
      gross: invoice.total,
      advanceApplied: invoice.advanceApplied,
      netPayable: invoice.netPayable,
      customerId: invoice.customerId,
      jobId: invoice.jobId,
    });

    const issued = invoices.filter((invoice) => invoice.status === 'issued');
    const invoiceSummary = (list: typeof issued) => {
      let taxable = 0;
      let vat = 0;
      let gross = 0;
      let advances = 0;
      let net = 0;
      for (const invoice of list) {
        const sign = invoice.kind === 'credit_note' ? -1 : 1;
        taxable += sign * invoice.subtotal;
        vat += sign * invoice.vatAmount;
        gross += sign * invoice.total;
        advances += invoice.advanceApplied;
        net += sign * invoice.netPayable;
      }
      return {
        count: list.length,
        taxable: roundMoney(taxable),
        vat: roundMoney(vat),
        gross: roundMoney(gross),
        advances: roundMoney(advances),
        net: roundMoney(net),
      };
    };

    const sharedSummary = (list: typeof issued): ReportResult['summary'] => {
      const s = invoiceSummary(list);
      return [
        { label: 'Count', value: s.count },
        { label: 'Taxable', value: s.taxable, money: true },
        { label: 'VAT 5%', value: s.vat, money: true },
        { label: 'Gross', value: s.gross, money: true },
        { label: 'Advances applied', value: s.advances, money: true },
        { label: 'Net payable', value: s.net, money: true },
      ];
    };

    const title =
      INVOICE_REPORT_VIEWS.find((v) => v.key === view)?.label ?? view;

    const baseParams = {
      from: isoDate(from),
      to: isoDate(to),
      customerId: query.customerId ?? null,
      jobId: query.jobId ?? null,
      kind: query.kind ?? 'all',
      status: query.status ?? (view === 'master' ? 'issued' : 'all'),
    };

    if (view === 'master') {
      const list =
        !query.status || query.status === 'issued'
          ? issued
          : query.status === 'cancelled'
            ? invoices.filter((i) => i.status === 'cancelled')
            : invoices;
      const rows = list.map(toMasterRow);
      const s = invoiceSummary(
        list.filter((i) => i.status === 'issued') as typeof issued,
      );
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: baseParams,
        summary: sharedSummary(
          list.filter((i) => i.status === 'issued') as typeof issued,
        ),
        columns: masterColumns,
        rows,
        footerNote: `Sum of row gross (issued) = ${s.gross.toFixed(2)} AED`,
      };
    }

    if (view === 'by-customer' || view === 'by-job') {
      const groupKey = view === 'by-customer' ? 'customer' : 'job';
      const groups = new Map<string, ReturnType<typeof toMasterRow>[]>();
      for (const invoice of issued) {
        const row = toMasterRow(invoice);
        const key =
          view === 'by-customer'
            ? row.customer
            : row.job === '—'
              ? 'No job'
              : row.job;
        const list = groups.get(key) ?? [];
        list.push(row);
        groups.set(key, list);
      }
      const rows: Array<Record<string, string | number | null>> = [];
      for (const [name, list] of [...groups.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        rows.push({
          number: '',
          kind: '',
          status: '',
          customer: view === 'by-customer' ? name : '',
          job: view === 'by-job' ? name : '',
          issueDate: '',
          dueDate: 'Subtotal',
          taxable: roundMoney(list.reduce((t, r) => t + Number(r.taxable), 0)),
          vat: roundMoney(list.reduce((t, r) => t + Number(r.vat), 0)),
          gross: roundMoney(list.reduce((t, r) => t + Number(r.gross), 0)),
          advanceApplied: roundMoney(
            list.reduce((t, r) => t + Number(r.advanceApplied), 0),
          ),
          netPayable: roundMoney(
            list.reduce((t, r) => t + Number(r.netPayable), 0),
          ),
        });
        rows.push(...list);
      }
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: baseParams,
        summary: sharedSummary(issued),
        columns: masterColumns,
        rows,
        footerNote: `Grouped by ${groupKey}`,
      };
    }

    if (view === 'by-kind') {
      const kinds = ['progressive', 'custom', 'final', 'credit_note'] as const;
      const rows = kinds.map((kind) => {
        const list = issued.filter((invoice) => invoice.kind === kind);
        const s = invoiceSummary(list);
        return {
          kind,
          count: s.count,
          taxable: s.taxable,
          vat: s.vat,
          gross: s.gross,
        };
      });
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: baseParams,
        summary: sharedSummary(issued),
        columns: [
          { key: 'kind', label: 'Kind' },
          { key: 'count', label: 'Count', align: 'right' },
          ...moneyCols([
            ['taxable', 'Taxable'],
            ['vat', 'VAT'],
            ['gross', 'Gross'],
          ]),
        ],
        rows,
      };
    }

    if (view === 'by-status') {
      const statuses = ['issued', 'cancelled'] as const;
      const rows = statuses.flatMap((status) => {
        const list = invoices.filter((invoice) => invoice.status === status);
        return list.map(toMasterRow);
      });
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: { ...baseParams, status: 'all' },
        summary: [
          ...sharedSummary(issued),
          {
            label: 'Cancelled',
            value: invoices.filter((i) => i.status === 'cancelled').length,
          },
        ],
        columns: masterColumns,
        rows,
        footerNote: 'Money totals are issued-only; cancelled listed for numbering',
      };
    }

    if (view === 'monthly') {
      const byMonth = new Map<
        string,
        {
          month: string;
          count: number;
          taxable: number;
          vat: number;
          gross: number;
          creditGross: number;
        }
      >();
      for (const invoice of invoices.filter((i) => i.status === 'issued')) {
        const key = invoice.issueDate.toISOString().slice(0, 7);
        const row = byMonth.get(key) ?? {
          month: key,
          count: 0,
          taxable: 0,
          vat: 0,
          gross: 0,
          creditGross: 0,
        };
        row.count += 1;
        if (invoice.kind === 'credit_note') {
          row.creditGross += invoice.total;
          row.taxable -= invoice.subtotal;
          row.vat -= invoice.vatAmount;
        } else {
          row.taxable += invoice.subtotal;
          row.vat += invoice.vatAmount;
          row.gross += invoice.total;
        }
        byMonth.set(key, row);
      }
      const rows = [...byMonth.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((row) => ({
          month: row.month,
          count: row.count,
          taxable: roundMoney(row.taxable),
          vat: roundMoney(row.vat),
          gross: roundMoney(row.gross),
          creditGross: roundMoney(row.creditGross),
          netBilled: roundMoney(row.gross - row.creditGross),
        }));
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: baseParams,
        summary: sharedSummary(issued),
        columns: [
          { key: 'month', label: 'Month' },
          { key: 'count', label: 'Count', align: 'right' },
          ...moneyCols([
            ['taxable', 'Taxable'],
            ['vat', 'VAT'],
            ['gross', 'Gross'],
            ['creditGross', 'Credit notes'],
            ['netBilled', 'Net billed'],
          ]),
        ],
        rows,
      };
    }

    if (view === 'credit-notes') {
      const list = issued.filter((invoice) => invoice.kind === 'credit_note');
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: baseParams,
        summary: sharedSummary(list),
        columns: [
          { key: 'number', label: 'CN number' },
          { key: 'original', label: 'Original invoice' },
          { key: 'customer', label: 'Customer' },
          { key: 'job', label: 'Job' },
          { key: 'issueDate', label: 'Issue' },
          ...moneyCols([
            ['taxable', 'Taxable'],
            ['vat', 'VAT'],
            ['gross', 'Gross'],
          ]),
        ],
        rows: list.map((invoice) => ({
          number: invoice.number,
          original: invoice.creditNoteFor?.number ?? '—',
          customer: invoice.customer.name,
          job: invoice.job?.number ?? '—',
          issueDate: dayLabel(invoice.issueDate),
          taxable: invoice.subtotal,
          vat: invoice.vatAmount,
          gross: invoice.total,
        })),
        footerNote: 'Credit notes reverse billed value and VAT',
      };
    }

    if (view === 'outstanding' || view === 'overdue') {
      const openInvoices = await this.prisma.invoice.findMany({
        where: {
          companyId,
          status: 'issued',
          kind: { not: 'credit_note' },
          issueDate: { lte: asOf },
          ...(query.customerId ? { customerId: query.customerId } : {}),
          ...(query.jobId ? { jobId: query.jobId } : {}),
        },
        include: {
          customer: { select: { id: true, name: true } },
          job: { select: { number: true } },
        },
      });
      const advances = await this.prisma.advancePayment.findMany({
        where: {
          companyId,
          cancelledAt: null,
          receivedAt: { lte: asOf },
          ...(query.customerId ? { customerId: query.customerId } : {}),
        },
      });
      const aged = ageReceivables({
        invoices: openInvoices
          .filter((invoice) => invoice.netPayable > 0)
          .map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            customerId: invoice.customerId,
            customerName: invoice.customer.name,
            jobId: invoice.jobId,
            jobNumber: invoice.job?.number ?? null,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            netPayable: invoice.netPayable,
            advanceApplied: invoice.advanceApplied,
          })),
        advances,
        asOf,
      });

      let rows = aged.rows;
      if (view === 'overdue') {
        const asOfStart = startOfUtcDay(asOf).getTime();
        rows = rows.filter((row) => {
          const due = new Date(row.dueDate ?? row.issueDate);
          return startOfUtcDay(due).getTime() < asOfStart;
        });
      }

      const outstanding = roundMoney(
        rows.reduce((t, r) => t + r.outstanding, 0),
      );

      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: {
          ...baseParams,
          asOf: isoDate(asOf),
        },
        summary: [
          { label: 'Invoices', value: rows.length },
          { label: 'Outstanding', value: outstanding, money: true },
        ],
        columns: [
          { key: 'number', label: 'Invoice' },
          { key: 'customer', label: 'Customer' },
          { key: 'job', label: 'Job' },
          { key: 'issueDate', label: 'Issue' },
          { key: 'dueDate', label: 'Due' },
          {
            key: 'outstanding',
            label: 'Outstanding',
            align: 'right',
            money: true,
          },
        ],
        rows: rows.map((row) => ({
          number: row.number,
          customer: row.customerName,
          job: row.jobNumber ?? '—',
          issueDate: dayLabel(row.issueDate),
          dueDate: dayLabel(row.dueDate ?? row.issueDate),
          outstanding: row.outstanding,
        })),
        footerNote: `FIFO unallocated advances applied; outstanding ${outstanding.toFixed(2)} AED`,
      };
    }

    if (view === 'advances-on-invoices') {
      const allocationRows = invoices.flatMap((invoice) =>
        invoice.allocations.map((allocation) => ({
          invoiceNumber: invoice.number,
          advanceNumber: allocation.advance.number,
          amount: roundMoney(allocation.amount),
          date: dayLabel(allocation.advance.receivedAt),
          invoiceApplied: invoice.advanceApplied,
        })),
      );

      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: baseParams,
        summary: [
          { label: 'Allocations', value: allocationRows.length },
          {
            label: 'Total applied',
            value: roundMoney(
              allocationRows.reduce((t, r) => t + r.amount, 0),
            ),
            money: true,
          },
        ],
        columns: [
          { key: 'invoiceNumber', label: 'Invoice' },
          { key: 'advanceNumber', label: 'Advance' },
          { key: 'date', label: 'Advance date' },
          { key: 'amount', label: 'Amount', align: 'right', money: true },
        ],
        rows: allocationRows,
        footerNote:
          'Control: sum per invoice should equal invoice.advanceApplied',
      };
    }

    if (view === 'uae-tax') {
      const list = issued.filter((invoice) => invoice.kind !== 'credit_note');
      const credits = issued.filter((invoice) => invoice.kind === 'credit_note');
      const rows = [...list, ...credits].map((invoice) => ({
        number: invoice.number,
        issueDate: dayLabel(invoice.issueDate),
        buyerName: invoice.customer.name,
        buyerTrn: invoice.customer.trn ?? '—',
        kind: invoice.kind,
        taxable: invoice.kind === 'credit_note' ? -invoice.subtotal : invoice.subtotal,
        vat: invoice.kind === 'credit_note' ? -invoice.vatAmount : invoice.vatAmount,
        gross: invoice.kind === 'credit_note' ? -invoice.total : invoice.total,
      }));
      const s = invoiceSummary(issued);
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: baseParams,
        summary: [
          { label: 'Documents', value: rows.length },
          { label: 'Taxable', value: s.taxable, money: true },
          { label: 'VAT 5%', value: s.vat, money: true },
          { label: 'Gross', value: s.gross, money: true },
        ],
        columns: [
          { key: 'number', label: 'Number' },
          { key: 'issueDate', label: 'Issue date' },
          { key: 'buyerName', label: 'Buyer name' },
          { key: 'buyerTrn', label: 'Buyer TRN' },
          { key: 'kind', label: 'Kind' },
          ...moneyCols([
            ['taxable', 'Taxable'],
            ['vat', 'VAT 5%'],
            ['gross', 'Gross'],
          ]),
        ],
        rows,
        footerNote: 'Audit list — not FTA e-invoicing. Credit notes net negative.',
      };
    }

    if (view === 'vat-drilldown') {
      const byMonth = new Map<
        string,
        {
          month: string;
          issuedVat: number;
          creditVat: number;
          invoiceCount: number;
          creditCount: number;
        }
      >();
      for (const invoice of issued) {
        const key = invoice.issueDate.toISOString().slice(0, 7);
        const row = byMonth.get(key) ?? {
          month: key,
          issuedVat: 0,
          creditVat: 0,
          invoiceCount: 0,
          creditCount: 0,
        };
        if (invoice.kind === 'credit_note') {
          row.creditVat += invoice.vatAmount;
          row.creditCount += 1;
        } else {
          row.issuedVat += invoice.vatAmount;
          row.invoiceCount += 1;
        }
        byMonth.set(key, row);
      }
      const rows = [...byMonth.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((row) => ({
          month: row.month,
          invoiceCount: row.invoiceCount,
          creditCount: row.creditCount,
          issuedVat: roundMoney(row.issuedVat),
          creditVat: roundMoney(row.creditVat),
          netVat: roundMoney(row.issuedVat - row.creditVat),
        }));
      const netVat = roundMoney(
        rows.reduce((t, r) => t + Number(r.netVat), 0),
      );
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: baseParams,
        summary: [
          { label: 'Months', value: rows.length },
          { label: 'Net VAT', value: netVat, money: true },
        ],
        columns: [
          { key: 'month', label: 'Month' },
          { key: 'invoiceCount', label: 'Invoices', align: 'right' },
          { key: 'creditCount', label: 'Credit notes', align: 'right' },
          ...moneyCols([
            ['issuedVat', 'Issued VAT'],
            ['creditVat', 'Credit VAT'],
            ['netVat', 'Net VAT'],
          ]),
        ],
        rows,
        footerNote: 'Issued VAT minus credit-note VAT by calendar month',
      };
    }

    if (view === 'numbering-gaps') {
      const sorted = [...invoices].sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true }),
      );
      const parsed = sorted.map((invoice) => {
        const match = invoice.number.match(/^(.*?)(\d+)$/);
        return {
          number: invoice.number,
          prefix: match?.[1] ?? invoice.number,
          seq: match ? Number(match[2]) : null,
          status: invoice.status,
          issueDate: dayLabel(invoice.issueDate),
        };
      });
      const byPrefix = new Map<string, typeof parsed>();
      for (const row of parsed) {
        if (row.seq == null) continue;
        const list = byPrefix.get(row.prefix) ?? [];
        list.push(row);
        byPrefix.set(row.prefix, list);
      }
      const gapRows: Array<Record<string, string | number | null>> = [];
      let gapCount = 0;
      let dupeCount = 0;
      for (const [prefix, list] of [...byPrefix.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        const seen = new Map<number, number>();
        for (const row of list) {
          const seq = row.seq!;
          seen.set(seq, (seen.get(seq) ?? 0) + 1);
        }
        for (const [seq, count] of seen) {
          if (count > 1) {
            dupeCount += 1;
            gapRows.push({
              flag: 'duplicate',
              number: `${prefix}${seq}`,
              detail: `${count} documents share this number`,
              status: '—',
              issueDate: '—',
            });
          }
        }
        const seqs = [...seen.keys()].sort((a, b) => a - b);
        for (let i = 1; i < seqs.length; i++) {
          const prev = seqs[i - 1]!;
          const next = seqs[i]!;
          if (next - prev > 1) {
            for (let missing = prev + 1; missing < next; missing++) {
              gapCount += 1;
              gapRows.push({
                flag: 'gap',
                number: `${prefix}${String(missing).padStart(
                  String(next).length,
                  '0',
                )}`,
                detail: `Missing between ${prefix}${prev} and ${prefix}${next}`,
                status: '—',
                issueDate: '—',
              });
            }
          }
        }
      }
      const seriesRows = parsed.map((row) => ({
        flag: 'ok',
        number: row.number,
        detail: row.seq == null ? 'Non-numeric suffix' : 'In series',
        status: row.status,
        issueDate: row.issueDate,
      }));
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: baseParams,
        summary: [
          { label: 'Documents', value: sorted.length },
          { label: 'Gaps', value: gapCount },
          { label: 'Duplicates', value: dupeCount },
        ],
        columns: [
          { key: 'flag', label: 'Flag' },
          { key: 'number', label: 'Number' },
          { key: 'detail', label: 'Detail' },
          { key: 'status', label: 'Status' },
          { key: 'issueDate', label: 'Issue' },
        ],
        rows: [...gapRows, ...seriesRows],
        footerNote: 'Not a money report — numbering control only',
      };
    }

    if (view === 'cancelled') {
      const list = invoices.filter((invoice) => invoice.status === 'cancelled');
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: { ...baseParams, status: 'cancelled' },
        summary: [
          { label: 'Cancelled', value: list.length },
          {
            label: 'Gross voided',
            value: roundMoney(list.reduce((t, i) => t + i.total, 0)),
            money: true,
          },
        ],
        columns: [
          { key: 'number', label: 'Number' },
          { key: 'cancelledAt', label: 'Cancelled' },
          { key: 'customer', label: 'Customer' },
          { key: 'kind', label: 'Kind' },
          { key: 'issueDate', label: 'Issue' },
          ...moneyCols([
            ['taxable', 'Taxable'],
            ['vat', 'VAT'],
            ['gross', 'Gross'],
          ]),
        ],
        rows: list.map((invoice) => ({
          number: invoice.number,
          cancelledAt: dayLabel(invoice.cancelledAt),
          customer: invoice.customer.name,
          kind: invoice.kind,
          issueDate: dayLabel(invoice.issueDate),
          taxable: invoice.subtotal,
          vat: invoice.vatAmount,
          gross: invoice.total,
        })),
      };
    }

    if (view === 'lines') {
      const withLines = await this.prisma.invoice.findMany({
        where: {
          companyId,
          issueDate: { gte: from, lte: to },
          status: 'issued',
          ...(query.customerId ? { customerId: query.customerId } : {}),
          ...(query.jobId ? { jobId: query.jobId } : {}),
          ...(query.kind && query.kind !== 'all' ? { kind: query.kind } : {}),
        },
        include: {
          customer: { select: { name: true } },
          lines: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
      });
      const rows = withLines.flatMap((invoice) =>
        invoice.lines.map((line) => ({
          number: invoice.number,
          customer: invoice.customer.name,
          description: line.description,
          qty: line.qty,
          unit: line.unit,
          unitPrice: line.unitPrice,
          purchasePrice: line.purchasePrice,
          lineTotal: line.lineTotal,
        })),
      );
      return {
        key: `invoices/${view}`,
        title: `Invoices — ${title}`,
        params: baseParams,
        summary: [
          { label: 'Lines', value: rows.length },
          {
            label: 'Line total',
            value: roundMoney(rows.reduce((t, r) => t + r.lineTotal, 0)),
            money: true,
          },
        ],
        columns: [
          { key: 'number', label: 'Invoice' },
          { key: 'customer', label: 'Customer' },
          { key: 'description', label: 'Description' },
          { key: 'qty', label: 'Qty', align: 'right' },
          { key: 'unit', label: 'Unit' },
          ...moneyCols([
            ['unitPrice', 'Unit price'],
            ['purchasePrice', 'Purchase'],
            ['lineTotal', 'Line total'],
          ]),
        ],
        rows,
      };
    }

    throw new BadRequestException(`Unknown invoice report view: ${view}`);
  }

  private async supplier(companyId: string, supplierId?: string) {
    if (!supplierId) return null;
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, companyId },
      select: { id: true, name: true },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  private async supplierProductRegister(companyId: string, query: ReportQuery): Promise<ReportResult> {
    const supplier = await this.supplier(companyId, query.supplierId);
    const products = await this.prisma.product.findMany({
      where: { companyId, ...(query.supplierId ? { supplierId: query.supplierId } : {}) },
      orderBy: [{ supplier: { name: 'asc' } }, { name: 'asc' }],
      include: { supplier: { select: { id: true, name: true } } },
    });
    const purchase = products.reduce((sum, product) => sum + product.purchasePrice, 0);
    const sell = products.reduce((sum, product) => sum + product.sellPrice, 0);
    return {
      key: 'supplier-product-register',
      title: supplier ? `Supplier product register — ${supplier.name}` : 'Supplier product register',
      params: { supplierId: supplier?.id ?? null, supplierName: supplier?.name ?? null },
      summary: [
        { label: 'Products', value: products.length },
        { label: 'Catalog purchase value', value: roundMoney(purchase), money: true },
        { label: 'Catalog sell value', value: roundMoney(sell), money: true },
        { label: 'Estimated margin', value: roundMoney(sell - purchase), money: true },
      ],
      columns: [
        { key: 'supplier', label: 'Supplier' },
        { key: 'name', label: 'Product' },
        { key: 'sku', label: 'SKU' },
        { key: 'purchasePrice', label: 'Purchase', align: 'right', money: true },
        { key: 'sellPrice', label: 'Sell', align: 'right', money: true },
        { key: 'margin', label: 'Margin', align: 'right', money: true },
        { key: 'active', label: 'Status' },
      ],
      rows: products.map((product) => ({
        supplier: product.supplier?.name ?? 'Unassigned',
        name: product.name,
        sku: product.sku,
        purchasePrice: roundMoney(product.purchasePrice),
        sellPrice: roundMoney(product.sellPrice),
        margin: roundMoney(product.sellPrice - product.purchasePrice),
        active: product.active ? 'Active' : 'Inactive',
      })),
      footerNote: 'Values are catalog price exposure, not posted supplier liabilities.',
    };
  }

  private async supplierCostSummary(companyId: string, query: ReportQuery): Promise<ReportResult> {
    const selected = await this.supplier(companyId, query.supplierId);
    const suppliers = await this.prisma.supplier.findMany({
      where: { companyId, ...(query.supplierId ? { id: query.supplierId } : {}) },
      orderBy: { name: 'asc' },
      include: { products: { select: { purchasePrice: true, sellPrice: true, active: true } } },
    });
    const rows = suppliers.map((supplier) => {
      const purchase = supplier.products.reduce((sum, product) => sum + product.purchasePrice, 0);
      const sell = supplier.products.reduce((sum, product) => sum + product.sellPrice, 0);
      return { supplier: supplier.name, products: supplier.products.length, activeProducts: supplier.products.filter((product) => product.active).length, purchaseValue: roundMoney(purchase), sellValue: roundMoney(sell), margin: roundMoney(sell - purchase) };
    });
    return {
      key: 'supplier-cost-summary',
      title: selected ? `Supplier cost summary — ${selected.name}` : 'Supplier cost summary',
      params: { supplierId: selected?.id ?? null, supplierName: selected?.name ?? null },
      summary: [
        { label: 'Suppliers', value: rows.length },
        { label: 'Purchase exposure', value: roundMoney(rows.reduce((sum, row) => sum + row.purchaseValue, 0)), money: true },
        { label: 'Estimated margin', value: roundMoney(rows.reduce((sum, row) => sum + row.margin, 0)), money: true },
      ],
      columns: [
        { key: 'supplier', label: 'Supplier' },
        { key: 'products', label: 'Products', align: 'right' },
        { key: 'activeProducts', label: 'Active', align: 'right' },
        { key: 'purchaseValue', label: 'Purchase value', align: 'right', money: true },
        { key: 'sellValue', label: 'Sell value', align: 'right', money: true },
        { key: 'margin', label: 'Estimated margin', align: 'right', money: true },
      ],
      rows,
    };
  }

  private async supplierQuotationUsage(companyId: string, query: ReportQuery): Promise<ReportResult> {
    const selected = await this.supplier(companyId, query.supplierId);
    const { from, to } = this.period(query);
    const lines = await this.prisma.quotationLine.findMany({
      where: {
        quotation: { companyId, createdAt: { gte: from, lte: to } },
        product: { supplierId: query.supplierId ?? { not: null } },
      },
      include: {
        product: { include: { supplier: { select: { id: true, name: true } } } },
        quotation: { include: { customer: { select: { name: true } } } },
      },
      orderBy: { quotation: { createdAt: 'desc' } },
    });
    const filtered = query.supplierId ? lines.filter((line) => line.product?.supplier?.id === query.supplierId) : lines;
    const rows = filtered.map((line) => ({ quotation: line.quotation.number, customer: line.quotation.customer.name, supplier: line.product?.supplier?.name ?? 'Unassigned', product: line.product?.name ?? line.description, qty: line.qty, purchaseTotal: roundMoney(line.purchasePrice * line.qty), sellTotal: roundMoney(line.sellPrice * line.qty), margin: roundMoney((line.sellPrice - line.purchasePrice) * line.qty) }));
    return {
      key: 'supplier-quotation-usage',
      title: selected ? `Supplier quotation usage — ${selected.name}` : 'Supplier quotation usage',
      params: { from: isoDate(from), to: isoDate(to), supplierId: selected?.id ?? null, supplierName: selected?.name ?? null },
      summary: [{ label: 'Quoted lines', value: rows.length }, { label: 'Purchase cost', value: roundMoney(rows.reduce((sum, row) => sum + row.purchaseTotal, 0)), money: true }, { label: 'Estimated margin', value: roundMoney(rows.reduce((sum, row) => sum + row.margin, 0)), money: true }],
      columns: [{ key: 'quotation', label: 'Quotation' }, { key: 'customer', label: 'Customer' }, { key: 'supplier', label: 'Supplier' }, { key: 'product', label: 'Product' }, { key: 'qty', label: 'Qty', align: 'right' }, ...moneyCols([['purchaseTotal', 'Purchase cost'], ['sellTotal', 'Sell total'], ['margin', 'Margin']])],
      rows,
    };
  }

  private async supplierJobCosting(companyId: string, query: ReportQuery): Promise<ReportResult> {
    const selected = await this.supplier(companyId, query.supplierId);
    const { from, to } = this.period(query);
    const jobs = await this.prisma.job.findMany({
      where: { companyId, createdAt: { gte: from, lte: to } },
      include: { customer: { select: { name: true } }, quotation: { include: { lines: { include: { product: { include: { supplier: { select: { id: true, name: true } } } } } } } } },
      orderBy: { createdAt: 'desc' },
    });
    const grouped = new Map<string, { job: string; customer: string; supplier: string; purchaseCost: number; sellValue: number }>();
    for (const job of jobs) {
      for (const line of job.quotation.lines) {
        const supplier = line.product?.supplier;
        if (!supplier || (query.supplierId && supplier.id !== query.supplierId)) continue;
        const key = `${job.id}:${supplier.id}`;
        const row = grouped.get(key) ?? { job: job.number, customer: job.customer.name, supplier: supplier.name, purchaseCost: 0, sellValue: 0 };
        row.purchaseCost += line.purchasePrice * line.qty;
        row.sellValue += line.sellPrice * line.qty;
        grouped.set(key, row);
      }
    }
    const rows = [...grouped.values()].map((row) => ({ ...row, purchaseCost: roundMoney(row.purchaseCost), sellValue: roundMoney(row.sellValue), margin: roundMoney(row.sellValue - row.purchaseCost) }));
    return {
      key: 'supplier-job-costing',
      title: selected ? `Supplier job costing — ${selected.name}` : 'Supplier job costing',
      params: { from: isoDate(from), to: isoDate(to), supplierId: selected?.id ?? null, supplierName: selected?.name ?? null },
      summary: [{ label: 'Job/supplier rows', value: rows.length }, { label: 'Purchase cost', value: roundMoney(rows.reduce((sum, row) => sum + row.purchaseCost, 0)), money: true }, { label: 'Estimated margin', value: roundMoney(rows.reduce((sum, row) => sum + row.margin, 0)), money: true }],
      columns: [{ key: 'job', label: 'Job' }, { key: 'customer', label: 'Customer' }, { key: 'supplier', label: 'Supplier' }, ...moneyCols([['purchaseCost', 'Purchase cost'], ['sellValue', 'Sell value'], ['margin', 'Margin']])],
      rows,
      footerNote: 'Supplier costs are derived from quotation line snapshots. This is not a payable ledger.',
    };
  }

  private async supplierAccounting(companyId: string, key: ReportKey, query: ReportQuery): Promise<ReportResult> {
    const { from, to } = this.period(query);
    const supplierWhere = query.supplierId ? { supplierId: query.supplierId } : {};
    const [suppliers, invoices, payments, entries, lpos, prices] = await Promise.all([
      this.prisma.supplier.findMany({ where: { companyId, ...(query.supplierId ? { id: query.supplierId } : {}) }, select: { id: true, name: true } }),
      this.prisma.purchaseInvoice.findMany({ where: { companyId, ...supplierWhere, issueDate: { gte: from, lte: to } }, include: { supplier: { select: { name: true } } }, orderBy: { issueDate: 'asc' } }),
      this.prisma.supplierPayment.findMany({ where: { companyId, ...supplierWhere, paidAt: { gte: from, lte: to } }, include: { supplier: { select: { name: true } } }, orderBy: { paidAt: 'asc' } }),
      this.prisma.supplierLedgerEntry.findMany({ where: { companyId, ...supplierWhere, occurredAt: { gte: from, lte: to } }, include: { supplier: { select: { name: true } } }, orderBy: { occurredAt: 'asc' } }),
      this.prisma.lpo.findMany({ where: { companyId, ...supplierWhere, createdAt: { gte: from, lte: to } }, include: { supplier: { select: { name: true } }, lines: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.supplierPriceHistory.findMany({ where: { companyId, ...supplierWhere, effectiveAt: { gte: from, lte: to } }, include: { supplier: { select: { name: true } } }, orderBy: { effectiveAt: 'asc' } }),
    ]);
    const title = REPORT_NAV.find((report) => report.key === key)?.label ?? key;
    let rows: Array<Record<string, string | number | null>> = [];
    let columns: ReportResult['columns'] = [];
    if (key === 'supplier-statement') {
      let balance = 0;
      rows = entries.map((entry) => {
        balance += entry.direction === 'credit' ? entry.amount : -entry.amount;
        return { date: dayLabel(entry.occurredAt), supplier: entry.supplier.name, description: entry.description, direction: entry.direction, amount: roundMoney(entry.amount), balance: roundMoney(balance) };
      });
      columns = [{ key: 'date', label: 'Date' }, { key: 'supplier', label: 'Supplier' }, { key: 'description', label: 'Description' }, { key: 'direction', label: 'Direction' }, ...moneyCols([['amount', 'Amount'], ['balance', 'Balance']])];
    } else if (key === 'aged-payables') {
      const asOf = this.asOf(query);
      const aged = await this.prisma.purchaseInvoice.findMany({ where: { companyId, ...supplierWhere, status: { in: ['posted', 'partially_paid'] }, dueDate: { lte: asOf } }, include: { supplier: { select: { name: true } } }, orderBy: { dueDate: 'asc' } });
      rows = aged.map((invoice) => {
        const days = Math.max(0, Math.floor((asOf.getTime() - (invoice.dueDate?.getTime() ?? asOf.getTime())) / 86400000));
        return { number: invoice.number, supplier: invoice.supplier.name, dueDate: dayLabel(invoice.dueDate), ageDays: days, bucket: days <= 30 ? '0–30' : days <= 60 ? '31–60' : days <= 90 ? '61–90' : '90+', balance: roundMoney(invoice.balance) };
      });
      columns = [{ key: 'number', label: 'Invoice' }, { key: 'supplier', label: 'Supplier' }, { key: 'dueDate', label: 'Due date' }, { key: 'ageDays', label: 'Age days' }, { key: 'bucket', label: 'Bucket' }, ...moneyCols([['balance', 'Balance']])];
    } else if (key === 'purchase-invoice-register') {
      rows = invoices.map((invoice) => ({ number: invoice.number, supplier: invoice.supplier.name, supplierReference: invoice.supplierInvoiceNumber, issueDate: dayLabel(invoice.issueDate), dueDate: dayLabel(invoice.dueDate), status: invoice.status, subtotal: roundMoney(invoice.subtotal), inputVat: roundMoney(invoice.inputVat), total: roundMoney(invoice.total), balance: roundMoney(invoice.balance) }));
      columns = [{ key: 'number', label: 'Invoice' }, { key: 'supplier', label: 'Supplier' }, { key: 'supplierReference', label: 'Supplier ref' }, { key: 'issueDate', label: 'Issue date' }, { key: 'dueDate', label: 'Due date' }, { key: 'status', label: 'Status' }, ...moneyCols([['subtotal', 'Subtotal'], ['inputVat', 'Input VAT'], ['total', 'Total'], ['balance', 'Balance']])];
    } else if (key === 'supplier-payment-register') {
      rows = payments.map((payment) => ({ number: payment.number, supplier: payment.supplier.name, date: dayLabel(payment.paidAt), method: payment.method, amount: roundMoney(payment.amount), unapplied: roundMoney(payment.unappliedAmount), reference: payment.reference ? `••••${payment.reference.slice(-4)}` : null }));
      columns = [{ key: 'number', label: 'Payment' }, { key: 'supplier', label: 'Supplier' }, { key: 'date', label: 'Date' }, { key: 'method', label: 'Method' }, ...moneyCols([['amount', 'Amount'], ['unapplied', 'Unapplied']]), { key: 'reference', label: 'Reference' }];
    } else if (key === 'lpo-register') {
      rows = lpos.map((lpo) => ({ number: lpo.number, supplier: lpo.supplier.name, date: dayLabel(lpo.createdAt), status: lpo.status, ordered: roundMoney(lpo.lines.reduce((sum, line) => sum + line.orderedQty * line.unitCost, 0)), received: roundMoney(lpo.lines.reduce((sum, line) => sum + line.receivedQty * line.unitCost, 0)), invoiced: roundMoney(lpo.lines.reduce((sum, line) => sum + line.invoicedQty * line.unitCost, 0)), remaining: roundMoney(lpo.lines.reduce((sum, line) => sum + (line.orderedQty - line.invoicedQty) * line.unitCost, 0)) }));
      columns = [{ key: 'number', label: 'LPO' }, { key: 'supplier', label: 'Supplier' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, ...moneyCols([['ordered', 'Ordered'], ['received', 'Received'], ['invoiced', 'Invoiced'], ['remaining', 'Remaining']])];
    } else if (key === 'supplier-price-history') {
      rows = prices.map((price) => ({ date: dayLabel(price.effectiveAt), supplier: price.supplier.name, product: price.productName, unitCost: roundMoney(price.unitCost), source: price.sourceType }));
      columns = [{ key: 'date', label: 'Date' }, { key: 'supplier', label: 'Supplier' }, { key: 'product', label: 'Product' }, ...moneyCols([['unitCost', 'Unit cost']]), { key: 'source', label: 'Source' }];
    } else {
      const bySupplier = new Map<string, { supplier: string; spend: number; inputVat: number; payments: number }>();
      for (const invoice of invoices.filter((item) => ['posted', 'partially_paid', 'paid'].includes(item.status))) { const row = bySupplier.get(invoice.supplier.name) ?? { supplier: invoice.supplier.name, spend: 0, inputVat: 0, payments: 0 }; row.spend += invoice.total; row.inputVat += invoice.inputVat; bySupplier.set(invoice.supplier.name, row); }
      for (const payment of payments) { const row = bySupplier.get(payment.supplier.name) ?? { supplier: payment.supplier.name, spend: 0, inputVat: 0, payments: 0 }; row.payments += payment.amount; bySupplier.set(payment.supplier.name, row); }
      rows = [...bySupplier.values()].map((row) => ({ ...row, spend: roundMoney(row.spend), inputVat: roundMoney(row.inputVat), payments: roundMoney(row.payments), cashOut: roundMoney(row.payments) }));
      columns = [{ key: 'supplier', label: 'Supplier' }, ...moneyCols([['spend', 'Spend'], ['inputVat', 'Input VAT'], ['payments', 'Payments'], ['cashOut', 'Cash out']])];
    }
    return { key, title, params: { from: isoDate(from), to: isoDate(to), supplierId: query.supplierId ?? null }, summary: [{ label: 'Rows', value: rows.length }, { label: 'Suppliers', value: suppliers.length }, { label: 'Invoices', value: invoices.length }, { label: 'Payments', value: payments.length }], columns, rows, footerNote: 'Supplier purchasing reports are company-scoped. Payment references are masked.' };
  }

  private async company(companyId: string): Promise<PdfCompany> {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
    });
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    return {
      legalName: profile?.legalName ?? company?.name ?? 'Company',
      tradeName: profile?.tradeName ?? null,
      address: profile?.address ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
      trn: profile?.trn ?? null,
      bankDetails: profile?.bankDetails ?? null,
      logoUrl: this.absolute(profile?.logoUrl),
      signatureUrl: this.absolute(profile?.signatureUrl),
      currency: profile?.currency ?? 'AED',
    };
  }

  private absolute(url?: string | null): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    const base =
      process.env.PUBLIC_API_URL?.replace(/\/$/, '') ||
      `http://127.0.0.1:${process.env.PORT ?? 3001}`;
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }
}
