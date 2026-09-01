import { createElement, type ReactElement } from 'react';
import { Image, Text, View } from '@react-pdf/renderer';
import { formatAmount, moneyColumn } from '@marble/domain';
import { styles } from './theme';
import type { PdfCompany, PdfLine, PdfParty } from './types';

/**
 * These templates are written with createElement rather than JSX so the package
 * compiles under the API's plain tsc build with no extra JSX configuration.
 */
const el = createElement;

export function text(
  style: unknown,
  value: string | number,
  key?: string,
): ReactElement {
  return el(Text, { style, key } as never, String(value));
}

function wrappedText(
  style: unknown,
  value: string | number,
  key: string,
): ReactElement {
  return el(View, { key }, text(style, value, `${key}-t`));
}

function stackLines(
  items: Array<string | null | undefined>,
  style: unknown,
  key: string,
): ReactElement | null {
  const lines = items.filter((item): item is string => Boolean(item));
  if (lines.length === 0) return null;
  return text(style, lines.join('\n'), key);
}

function tableHeadCell(
  boxStyle: unknown,
  label: string,
  key: string,
  textStyle?: unknown,
): ReactElement {
  return el(
    View,
    { style: boxStyle as never, key },
    text([styles.genHeadCell, textStyle].filter(Boolean), label, `${key}-t`),
  );
}

function tableCell(
  boxStyle: unknown,
  value: string | number,
  key: string,
  textStyle?: unknown,
): ReactElement {
  return el(
    View,
    { style: boxStyle as never, key },
    text(textStyle ?? boxStyle, value, `${key}-t`),
  );
}

export function partyBlock(
  label: string,
  party: PdfParty,
  key: string,
): ReactElement {
  return el(
    View,
    { style: styles.party, key },
    wrappedText(styles.partyLabel, label.toUpperCase(), `${key}-l`),
    wrappedText(styles.partyName, party.name, `${key}-n`),
    stackLines(
      [
        party.address,
        party.phone,
        party.email,
        party.trn ? `TRN ${party.trn}` : null,
      ],
      styles.partyLine,
      `${key}-d`,
    ),
  );
}

export function companyHeader(
  company: PdfCompany,
  docTitle: string,
  docNumber: string,
  meta: Array<[string, string]>,
): ReactElement {
  return el(
    View,
    { style: styles.header },
    el(
      View,
      null,
      company.logoUrl
        ? el(Image, { style: styles.logo, src: company.logoUrl })
        : null,
      wrappedText(
        styles.companyName,
        company.tradeName || company.legalName,
        'cname',
      ),
      stackLines(
        [
          company.tradeName ? company.legalName : null,
          company.address,
          [company.phone, company.email].filter(Boolean).join('  ·  ') || null,
          company.trn ? `TRN ${company.trn}` : null,
        ],
        styles.companyLine,
        'cmeta',
      ),
    ),
    el(
      View,
      { style: styles.docBlock },
      wrappedText(styles.docTitle, docTitle.toUpperCase(), 'dt'),
      wrappedText(styles.docNumber, docNumber, 'dn'),
      stackLines(
        meta.map(([label, value]) => `${label}: ${value}`),
        styles.docMeta,
        'dmeta',
      ),
    ),
  );
}

export function amountsInCurrency(
  currency: string,
  key = 'cur',
): ReactElement {
  return el(
    View,
    { style: styles.section, key },
    text(styles.bodyText, `All amounts in ${currency}.`, `${key}text`),
  );
}

export function lineTable(
  lines: PdfLine[],
  currency: string,
  showImages: boolean,
): ReactElement {
  const head = el(
    View,
    { style: styles.tableHead, key: 'head' },
    showImages
      ? el(View, { style: styles.thumbHolder, key: 'h0' })
      : null,
    tableHeadCell(styles.cellDescription, 'DESCRIPTION', 'h1'),
    tableHeadCell(styles.cellUnit, 'UNIT', 'h2', { textAlign: 'left' }),
    tableHeadCell(styles.cellQty, 'QTY', 'h3', { textAlign: 'right' }),
    tableHeadCell(styles.cellPrice, 'RATE', 'h4', { textAlign: 'right' }),
    tableHeadCell(styles.cellTotal, 'AMOUNT', 'h5', { textAlign: 'right' }),
  );

  const rows = lines.map((row, index) =>
    el(
      View,
      { style: styles.row, key: `r${index}`, wrap: false },
      showImages
        ? el(
            View,
            { style: styles.thumbHolder, key: `t${index}` },
            row.imageUrl
              ? el(Image, { style: styles.cellThumb, src: row.imageUrl })
              : null,
          )
        : null,
      text(
        [styles.cellDescription, styles.lineDescription],
        row.description,
        `d${index}`,
      ),
      text(styles.cellUnit, row.unit, `u${index}`),
      text(styles.cellQty, formatQty(row.qty), `q${index}`),
      text(styles.cellPrice, row.unitPrice.toFixed(2), `p${index}`),
      text(styles.cellTotal, row.lineTotal.toFixed(2), `a${index}`),
    ),
  );

  return el(
    View,
    null,
    head,
    ...rows,
    amountsInCurrency(currency),
  );
}

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
}

export function buildDiscountTotalRows(data: {
  lineGrossTotal?: number;
  lineDiscountTotal?: number;
  discount?: number;
  subtotal: number;
  vatAmount: number;
  vatRate: number;
}): Array<[string, number]> {
  const rows: Array<[string, number]> = [];
  const lineDisc = data.lineDiscountTotal ?? 0;
  const docDisc = data.discount ?? 0;
  if (lineDisc > 0 && data.lineGrossTotal !== undefined) {
    rows.push(['Subtotal (before discounts)', data.lineGrossTotal]);
    rows.push(['Line discounts', lineDisc]);
  }
  if (docDisc > 0) {
    rows.push(['Document discount', docDisc]);
  }
  rows.push(['Taxable amount', data.subtotal]);
  rows.push([`VAT @ ${(data.vatRate * 100).toFixed(0)}%`, data.vatAmount]);
  return rows;
}

export function totalsBlock(
  rows: Array<[string, number]>,
  grand: [string, number],
  currency: string,
): ReactElement {
  return el(
    View,
    { style: styles.totals, wrap: false },
    el(
      View,
      { style: styles.totalsBox },
      ...rows.map(([label, value], index) =>
        el(
          View,
          { style: styles.totalRow, key: `tr${index}` },
          text(styles.totalLabel, label, `trl${index}`),
          text(styles.totalValue, formatAmount(value), `trv${index}`),
        ),
      ),
      el(
        View,
        { style: styles.grandRow, key: 'grand' },
        text(styles.grandLabel, moneyColumn(grand[0], currency), 'gl'),
        text(styles.grandValue, formatAmount(grand[1]), 'gv'),
      ),
    ),
  );
}

export function section(
  title: string,
  body: string,
  key: string,
): ReactElement {
  return el(
    View,
    { style: styles.section, key },
    text(styles.sectionTitle, title.toUpperCase(), `${key}-t`),
    text(styles.bodyText, body, `${key}-b`),
  );
}

/**
 * react-pdf adds `minPresenceAhead` ON TOP OF the node's own height. A trailing
 * signature stack is ~80–110pt; wrapping it with 120–140pt presence made Yoga
 * demand ~200–250pt of leftover page and pushed the block to page 2 even when
 * it already fit. Trailing unbreakable bands should only pass a tiny cushion
 * (the page `paddingBottom` already clears the fixed footer).
 */
const TRAILING_CUSHION = 8;

export function keepTogether(
  children: Array<ReactElement | null>,
  minPresenceAhead = TRAILING_CUSHION,
): ReactElement {
  return el(
    View,
    { wrap: false, minPresenceAhead },
    ...children.filter(Boolean),
  );
}

/** Issuer stamp only — used on invoices, advances, and standard quotations. */
export function signatureBlock(company: PdfCompany): ReactElement {
  return el(
    View,
    { style: styles.signatureRow, wrap: false },
    el(View, null),
    el(
      View,
      null,
      company.signatureUrl
        ? el(Image, { style: styles.signature, src: company.signatureUrl })
        : null,
      text(
        styles.signatureLabel,
        `For ${company.tradeName || company.legalName}`,
        'sig',
      ),
    ),
  );
}

function clientSignatureField(label: string, key: string): ReactElement {
  return el(
    View,
    { style: styles.clientSigRow, key },
    text(styles.clientSigLabel, `${label}:`, `${key}-l`),
    el(View, { style: styles.clientSigLine, key: `${key}-u` }),
  );
}

/** Client acceptance lines left, issuer signature right — one row per field. */
export function quotationSignatureRow(company: PdfCompany): ReactElement {
  return el(
    View,
    { style: styles.signatureRow, wrap: false },
    el(
      View,
      { style: styles.clientSignatureCol },
      clientSignatureField('Client Name', 'cs-name'),
      clientSignatureField('Date', 'cs-date'),
      clientSignatureField('Signature', 'cs-sig'),
    ),
    el(
      View,
      { style: styles.issuerSignatureCol },
      company.signatureUrl
        ? el(Image, { style: styles.signature, src: company.signatureUrl })
        : el(View, { style: styles.signaturePlaceholder }),
      text(
        styles.signatureLabel,
        `For ${company.tradeName || company.legalName}`,
        'sig',
      ),
    ),
  );
}

/**
 * Signatures (and an optional thank-you) as one unit that never splits.
 * When nothing sits between totals and signatures, they share that unit so
 * both stay on the current page whenever they fit together.
 */
export function withSignatureClosing(
  leading: ReactElement | null,
  between: Array<ReactElement | null>,
  signatures: Array<ReactElement | null>,
): ReactElement {
  const middle = between.filter(Boolean) as ReactElement[];
  const band = keepTogether(signatures);
  if (!leading) return band;
  if (middle.length === 0) {
    return keepTogether([leading, ...signatures]);
  }
  return el(View, null, leading, ...middle, band);
}

export function footer(_company?: PdfCompany, _extra?: string): ReactElement {
  return el(Text, {
    style: styles.footer,
    fixed: true,
    render: ({
      pageNumber,
      totalPages,
    }: {
      pageNumber: number;
      totalPages: number;
    }) => (totalPages > 1 ? `${pageNumber} / ${totalPages}` : String(pageNumber)),
  } as never);
}

function formatPdfDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const month = parsed
    .toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
    .toUpperCase();
  const year = parsed.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

export function counterTopIntro(
  data: {
    contactName?: string | null;
    contactPhone?: string | null;
    location?: string | null;
    customerName: string;
  },
): ReactElement {
  const addressee = data.contactName?.trim() || data.customerName;
  return el(
    View,
    { style: styles.ctIntro },
    stackLines(
      [
        `To ${addressee}`,
        data.contactPhone ? `Contact ${data.contactPhone}` : null,
        data.location ? `Location ${data.location}` : null,
        'Dear Sir/Madam,',
      ],
      styles.ctIntroBlock,
      'head',
    ),
    text(
      styles.bodyText,
      'With reference to your enquiry, we are pleased to offer our best prices for the following items as listed below.',
      'intro',
    ),
  );
}

function formatSectionAmount(amount: number): string {
  return amount.toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function counterTopSectionBlock(
  section: {
    productName: string;
    amount: number;
    items: Array<{ label: string; value: string }>;
  },
  _currency: string,
  key: string,
): ReactElement {
  const specRows = section.items
    .filter((item) => item.label.trim())
    .map((item, index) =>
      el(
        View,
        { style: styles.ctSpecRow, key: `${key}-i${index}`, wrap: false },
        text(styles.ctSpecLabelText, item.label, `${key}-l${index}`),
        text(
          styles.ctSpecValueText,
          item.value || '—',
          `${key}-v${index}`,
        ),
      ),
    );

  return el(
    View,
    { style: styles.ctSection, key, wrap: false },
    text(styles.ctSectionTitle, section.productName.toUpperCase(), `${key}-t`),
    ...specRows,
    el(
      View,
      { style: styles.ctAmountRow, key: `${key}-amt`, wrap: false },
      text(
        [styles.ctSpecLabelText, styles.ctAmountText],
        'Amount',
        `${key}-al`,
      ),
      text(
        [styles.ctSpecValueText, styles.ctAmountText, styles.ctAmountNumber],
        formatSectionAmount(section.amount),
        `${key}-av`,
      ),
    ),
  );
}

export function counterTopTotalsBlock(
  rows: Array<[string, number]>,
  grand: [string, number],
  currency: string,
): ReactElement {
  return el(
    View,
    { style: styles.ctTotalsWrap, wrap: false },
    el(
      View,
      { style: styles.ctTotalsBox },
      ...rows.map(([label, value], index) =>
        el(
          View,
          { style: styles.totalRow, key: `ctr${index}` },
          text(styles.totalLabel, label, `ctrl${index}`),
          text(styles.totalValue, formatAmount(value), `ctrv${index}`),
        ),
      ),
      el(
        View,
        { style: styles.grandRow, key: 'ctgrand' },
        text(styles.grandLabel, moneyColumn(grand[0], currency), 'ctgl'),
        text(styles.grandValue, formatAmount(grand[1]), 'ctgv'),
      ),
    ),
  );
}

export function compactSection(
  title: string,
  body: string,
  key: string,
): ReactElement {
  const normalized = body.replace(/●/g, '- ').replace(/•/g, '- ');
  return el(
    View,
    { style: styles.ctCompactSection, key },
    text(styles.sectionTitle, title.toUpperCase(), `${key}-t`),
    text(styles.ctTermsBody, normalized, `${key}-b`),
  );
}

export function generalIntro(data: {
  customerName: string;
  contactPhone?: string | null;
  location?: string | null;
  subject?: string | null;
}): ReactElement {
  return el(
    View,
    { style: styles.genIntro },
    stackLines(
      [
        `Customer: ${data.customerName}`,
        data.contactPhone ? `Contact No: ${data.contactPhone}` : null,
        data.location ? `Location: ${data.location}` : null,
        data.subject?.trim() ? `Subject: ${data.subject.trim()}` : null,
      ],
      styles.genIntroBlock,
      'intro',
    ),
  );
}

/** Split standard terms lookup into payment block (page 1) and conditions (page 2). */
export function splitQuotationTerms(body: string): {
  payment: string | null;
  conditions: string | null;
} {
  const normalized = body.replace(/●/g, '- ').replace(/•/g, '- ');
  const splitAt = normalized.search(/\n\nB\)\s/);
  if (splitAt > 0) {
    const payment = normalized
      .slice(0, splitAt)
      .trim()
      .replace(/^A\)\s*Payment:\s*/i, '');
    return {
      payment: payment || null,
      conditions: normalized.slice(splitAt).trim(),
    };
  }
  return { payment: null, conditions: normalized.trim() || null };
}

export function generalLineTable(
  lines: PdfLine[],
  currency: string,
): ReactElement {
  const head = el(
    View,
    { style: styles.genTableHead, key: 'ghead' },
    tableHeadCell(styles.genCellSn, 'S/N', 'gh0', { textAlign: 'center' }),
    tableHeadCell(styles.genCellPicture, 'PICTURE', 'gh1', {
      textAlign: 'center',
      fontSize: 6.5,
    }),
    tableHeadCell(styles.cellDescription, 'DESCRIPTION', 'gh2', {
      textAlign: 'left',
    }),
    tableHeadCell(styles.genCellQty, 'QTY', 'gh3', { textAlign: 'right' }),
    tableHeadCell(styles.genCellRate, 'RATE', 'gh4', { textAlign: 'right' }),
    tableHeadCell(styles.genCellTotal, 'TOTAL', 'gh5', { textAlign: 'right' }),
  );

  const rows = lines.map((row, index) =>
    el(
      View,
      { style: styles.genRow, key: `gr${index}`, wrap: false },
      tableCell(styles.genCellSn, String(index + 1), `gsn${index}`, {
        ...styles.genCellSn,
        fontSize: 9,
      }),
      el(
        View,
        { style: styles.genCellPicture, key: `gt${index}` },
        row.imageUrl
          ? el(Image, { style: styles.cellThumb, src: row.imageUrl })
          : null,
      ),
      text(
        [styles.cellDescription, styles.lineDescription],
        row.description,
        `gd${index}`,
      ),
      tableCell(
        styles.genCellQty,
        `${formatQty(row.qty)} ${row.unit}`.trim(),
        `gq${index}`,
        styles.genCellQty,
      ),
      tableCell(
        styles.genCellRate,
        formatSectionAmount(row.unitPrice),
        `gp${index}`,
        styles.genCellRate,
      ),
      tableCell(
        styles.genCellTotal,
        formatSectionAmount(row.lineTotal),
        `ga${index}`,
        styles.genCellTotal,
      ),
    ),
  );

  return el(View, null, head, ...rows, amountsInCurrency(currency, 'gcur'));
}

export function generalThankYouBlock(company: PdfCompany): ReactElement {
  const companyName = company.tradeName || company.legalName;
  return el(
    View,
    { style: styles.genThankYouWrap, wrap: false },
    text(
      styles.genThankYou,
      'Thank you and we hope the above is in line with your requirement',
      'ty',
    ),
    text(
      styles.genDisclaimer,
      `${companyName} has the right to cease all the execution activities if payment is NOT done on time or as per agreed payment terms.`,
      'disc',
    ),
  );
}

export { formatPdfDate };
