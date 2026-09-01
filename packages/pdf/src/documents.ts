import { createElement, type ComponentProps, type ReactElement } from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';

/**
 * react-pdf keeps DocumentProps inside an internal namespace, so the element
 * type is derived from the exported component to stay assignable to
 * renderToBuffer.
 */
type PdfDocumentElement = ReactElement<ComponentProps<typeof Document>>;
import { formatMoney } from '@marble/domain';
import {
  companyHeader,
  compactSection,
  counterTopIntro,
  counterTopSectionBlock,
  counterTopTotalsBlock,
  footer,
  formatPdfDate,
  generalIntro,
  generalLineTable,
  generalThankYouBlock,
  keepTogether,
  lineTable,
  partyBlock,
  quotationSignatureRow,
  section,
  signatureBlock,
  splitQuotationTerms,
  text,
  totalsBlock,
} from './elements';
import { styles } from './theme';
import type {
  AdvanceReceiptPdfData,
  InvoicePdfData,
  QuotationPdfData,
  ReportPdfData,
} from './types';

const el = createElement;

function date(value?: string | null): string {
  return formatPdfDate(value);
}

function vatLabel(rate: number): string {
  return `VAT @ ${(rate * 100).toFixed(0)}%`;
}

function CounterTopQuotationDocument(
  data: QuotationPdfData,
): PdfDocumentElement {
  const meta: Array<[string, string]> = [
    ['Quotation Ref', data.number],
    ['Date', date(data.createdAt)],
  ];
  if (data.validUntil) meta.push(['Valid until', date(data.validUntil)]);

  const totalRows: Array<[string, number]> = [];
  if ((data.discount ?? 0) > 0) {
    totalRows.push(['Discount', data.discount ?? 0]);
  }
  totalRows.push(['Taxable Amount', data.subtotal]);
  totalRows.push([vatLabel(data.vatRate), data.vatAmount]);

  const termsBody = data.terms || data.bankDetails || null;

  return el(
    Document,
    { title: `Quotation ${data.number}` },
    el(
      Page,
      { size: 'A4', style: styles.page, wrap: true },
      data.status === 'cancelled'
        ? el(Text, { style: styles.watermark, fixed: true }, 'CANCELLED')
        : null,
      companyHeader(data.company, 'Quotation', data.number, meta),
      counterTopIntro({
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        location: data.location,
        customerName: data.customer.name,
      }),
      ...(data.sections ?? []).map((sectionRow, index) =>
        counterTopSectionBlock(
          sectionRow,
          data.company.currency,
          `sec${index}`,
        ),
      ),
      data.notes
        ? el(Text, { style: styles.ctNotes, wrap: true }, data.notes)
        : null,
      counterTopTotalsBlock(
        totalRows,
        ['Grand Total', data.total],
        data.company.currency,
      ),
      termsBody
        ? compactSection('Terms & Conditions', termsBody, 'terms')
        : null,
      keepTogether([quotationSignatureRow(data.company)], 130),
      footer(data.company, 'This quotation is not a tax invoice'),
    ),
  );
}

function GeneralQuotationDocument(data: QuotationPdfData): PdfDocumentElement {
  const meta: Array<[string, string]> = [
    ['Quotation Ref', data.number],
    ['Date', date(data.createdAt)],
  ];
  if (data.validUntil) meta.push(['Valid until', date(data.validUntil)]);

  const termsSplit = data.terms
    ? splitQuotationTerms(data.terms)
    : { payment: null, conditions: null };
  const paymentTerms = data.paymentTerms || termsSplit.payment;
  const conditions = termsSplit.conditions;

  const totalRows: Array<[string, number]> = [
    ['Taxable Amount', data.subtotal],
    ['Total without V.A.T.', data.subtotal],
    [vatLabel(data.vatRate), data.vatAmount],
  ];

  return el(
    Document,
    { title: `Quotation ${data.number}` },
    el(
      Page,
      { size: 'A4', style: styles.page, wrap: true },
      data.status === 'cancelled'
        ? el(Text, { style: styles.watermark, fixed: true }, 'CANCELLED')
        : null,
      companyHeader(data.company, 'Quotation', data.number, meta),
      generalIntro({
        customerName: data.customer.name,
        contactPhone: data.contactPhone || data.customer.phone,
        location: data.location || data.customer.address,
        subject: data.title,
      }),
      generalLineTable(data.lines),
      counterTopTotalsBlock(
        totalRows,
        ['Grand Total', data.total],
        data.company.currency,
      ),
      paymentTerms
        ? compactSection('Payment Terms', paymentTerms, 'pay')
        : null,
      data.notes ? compactSection('Notes', data.notes, 'notes') : null,
      keepTogether(
        [
          generalThankYouBlock(data.company),
          quotationSignatureRow(data.company),
        ],
        140,
      ),
      conditions
        ? compactSection('Terms and Conditions', conditions, 'terms')
        : null,
      footer(data.company, 'This quotation is not a tax invoice'),
    ),
  );
}

export function QuotationDocument(data: QuotationPdfData): PdfDocumentElement {
  if (data.kind === 'counter_top') {
    return CounterTopQuotationDocument(data);
  }

  if (data.kind === 'general') {
    return GeneralQuotationDocument(data);
  }

  const meta: Array<[string, string]> = [
    ['Date', date(data.createdAt)],
    ['Valid until', date(data.validUntil)],
    ['Status', data.status],
  ];

  return el(
    Document,
    { title: `Quotation ${data.number}` },
    el(
      Page,
      { size: 'A4', style: styles.page, wrap: true },
      data.status === 'cancelled'
        ? el(Text, { style: styles.watermark, fixed: true }, 'CANCELLED')
        : null,
      companyHeader(data.company, 'Quotation', data.number, meta),
      el(
        View,
        { style: styles.parties },
        partyBlock('Quotation for', data.customer, 'buyer'),
      ),
      data.title ? section('Subject', data.title, 'subject') : null,
      lineTable(data.lines, data.company.currency, true),
      totalsBlock(
        [
          ['Subtotal', data.subtotal],
          [vatLabel(data.vatRate), data.vatAmount],
        ],
        ['Total', data.total],
        data.company.currency,
      ),
      data.notes ? section('Notes', data.notes, 'notes') : null,
      data.company.bankDetails
        ? section('Bank details', data.company.bankDetails, 'bank')
        : null,
      keepTogether([signatureBlock(data.company)], 100),
      footer(data.company, 'This quotation is not a tax invoice'),
    ),
  );
}

const INVOICE_TITLE: Record<string, string> = {
  progressive: 'Tax Invoice',
  custom: 'Tax Invoice',
  final: 'Tax Invoice',
  credit_note: 'Credit Note',
};

export function InvoiceDocument(data: InvoicePdfData): PdfDocumentElement {
  const isCreditNote = data.kind === 'credit_note';
  const meta: Array<[string, string]> = [
    ['Issue date', date(data.issueDate)],
  ];
  if (!isCreditNote) meta.push(['Due date', date(data.dueDate)]);
  if (data.jobNumber) meta.push(['Job', data.jobNumber]);

  const totalRows: Array<[string, number]> = [
    ['Taxable amount', data.subtotal],
    [vatLabel(data.vatRate), data.vatAmount],
  ];
  if (!isCreditNote && data.advanceApplied > 0) {
    totalRows.push(['Total', data.total]);
    totalRows.push(['Advance adjusted', -data.advanceApplied]);
  }

  const grand: [string, number] = isCreditNote
    ? ['Total credited', data.total]
    : ['Net payable', data.netPayable];

  const allocationNote = data.allocations.length
    ? data.allocations
        .map(
          (allocation) =>
            `${allocation.number} (${date(allocation.receivedAt)}): ${formatMoney(
              allocation.amount,
              data.company.currency,
            )}`,
        )
        .join('\n')
    : null;

  return el(
    Document,
    { title: `${INVOICE_TITLE[data.kind] ?? 'Invoice'} ${data.number}` },
    el(
      Page,
      { size: 'A4', style: styles.page, wrap: true },
      data.status === 'cancelled'
        ? el(Text, { style: styles.watermark, fixed: true }, 'CANCELLED')
        : null,
      companyHeader(
        data.company,
        INVOICE_TITLE[data.kind] ?? 'Tax Invoice',
        data.number,
        meta,
      ),
      el(
        View,
        { style: styles.parties },
        partyBlock('Supplier', data.company as never, 'seller'),
        partyBlock('Recipient', data.customer, 'buyer'),
      ),
      lineTable(data.lines, data.company.currency, false),
      totalsBlock(totalRows, grand, data.company.currency),
      allocationNote
        ? section('Advances adjusted', allocationNote, 'alloc')
        : null,
      data.notes ? section('Notes', data.notes, 'notes') : null,
      data.company.bankDetails
        ? section('Payment details', data.company.bankDetails, 'bank')
        : null,
      keepTogether([signatureBlock(data.company)], 100),
      footer(
        data.company,
        isCreditNote
          ? 'Credit note issued under UAE VAT law'
          : 'Tax invoice issued under UAE VAT law',
      ),
    ),
  );
}

export function AdvanceReceiptDocument(
  data: AdvanceReceiptPdfData,
): PdfDocumentElement {
  const meta: Array<[string, string]> = [
    ['Received', date(data.receivedAt)],
    ['Method', data.method.replace(/_/g, ' ')],
  ];
  if (data.jobNumber) meta.push(['Job', data.jobNumber]);
  if (data.reference) meta.push(['Reference', data.reference]);

  return el(
    Document,
    { title: `Advance receipt ${data.number}` },
    el(
      Page,
      { size: 'A4', style: styles.page, wrap: true },
      companyHeader(data.company, 'Advance Receipt', data.number, meta),
      el(
        View,
        { style: styles.parties },
        partyBlock('Received from', data.customer, 'payer'),
      ),
      el(
        View,
        { style: styles.section },
        text(styles.sectionTitle, 'AMOUNT RECEIVED', 'amt-l'),
        text(
          { fontSize: 22, fontFamily: 'Helvetica-Bold' },
          formatMoney(data.amount, data.company.currency),
          'amt-v',
        ),
      ),
      section(
        'Note',
        data.notes ??
          'Received as an advance against work in progress. This receipt is not a tax invoice; VAT is accounted for on the tax invoice that adjusts this advance.',
        'note',
      ),
      keepTogether([signatureBlock(data.company)], 100),
      footer(data.company, 'Advance receipt'),
    ),
  );
}

function cellValue(
  value: string | number | null | undefined,
  money: boolean | undefined,
  currency: string,
): string {
  if (value == null || value === '') return '—';
  if (money && typeof value === 'number') {
    return formatMoney(value, currency);
  }
  return String(value);
}

export function ReportDocument(data: ReportPdfData): PdfDocumentElement {
  const colCount = Math.max(1, data.columns.length);
  const flex = 1 / colCount;

  const head = el(
    View,
    { style: styles.tableHead, key: 'rhead' },
    ...data.columns.map((col, index) =>
      text(
        [
          styles.headCell,
          {
            flex,
            textAlign: col.align === 'right' ? 'right' : 'left',
            paddingHorizontal: 2,
          },
        ],
        col.label.toUpperCase(),
        `rh${index}`,
      ),
    ),
  );

  const rows =
    data.rows.length === 0
      ? [
          el(
            View,
            { style: styles.row, key: 'empty' },
            text(styles.bodyText, 'No rows for these parameters.', 'empty-t'),
          ),
        ]
      : data.rows.map((row, rowIndex) =>
          el(
            View,
            { style: styles.row, key: `rr${rowIndex}`, wrap: false },
            ...data.columns.map((col, colIndex) =>
              text(
                {
                  flex,
                  textAlign: col.align === 'right' ? 'right' : 'left',
                  paddingHorizontal: 2,
                  fontSize: 8,
                },
                cellValue(row[col.key], col.money, data.company.currency),
                `rc${rowIndex}-${colIndex}`,
              ),
            ),
          ),
        );

  const summaryBlock =
    data.summary.length === 0
      ? null
      : el(
          View,
          {
            style: {
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 14,
            },
            key: 'sum',
          },
          ...data.summary.map((stat, index) =>
            el(
              View,
              {
                style: {
                  width: '30%',
                  backgroundColor: '#f4f6f8',
                  borderRadius: 4,
                  padding: 8,
                  marginBottom: 4,
                },
                key: `s${index}`,
              },
              text(
                {
                  fontSize: 7,
                  color: '#1a6b7a',
                  fontFamily: 'Helvetica-Bold',
                  letterSpacing: 0.5,
                  marginBottom: 2,
                },
                stat.label.toUpperCase(),
                `sl${index}`,
              ),
              text(
                { fontSize: 11, fontFamily: 'Helvetica-Bold' },
                typeof stat.value === 'number' && stat.money
                  ? formatMoney(stat.value, data.company.currency)
                  : String(stat.value),
                `sv${index}`,
              ),
            ),
          ),
        );

  return el(
    Document,
    { title: data.title },
    el(
      Page,
      { size: 'A4', style: styles.page, orientation: 'landscape' as never, wrap: true },
      companyHeader(data.company, data.title, data.subtitle ?? 'Report', data.meta),
      summaryBlock,
      el(View, null, head, ...rows),
      data.footerNote
        ? el(
            View,
            { style: styles.section, key: 'fn' },
            text(styles.bodyText, data.footerNote, 'fnt'),
          )
        : null,
      footer(data.company, data.footerNote ?? 'Finance report'),
    ),
  );
}

