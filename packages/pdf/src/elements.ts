import { createElement, type ReactElement } from 'react';
import { Image, Text, View } from '@react-pdf/renderer';
import { formatMoney } from '@marble/domain';
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

function line(value: string | null | undefined, key: string) {
  if (!value) return null;
  return text(styles.partyLine, value, key);
}

export function partyBlock(
  label: string,
  party: PdfParty,
  key: string,
): ReactElement {
  return el(
    View,
    { style: styles.party, key },
    text(styles.partyLabel, label.toUpperCase(), `${key}-l`),
    text(styles.partyName, party.name, `${key}-n`),
    line(party.address, `${key}-a`),
    line(party.phone, `${key}-p`),
    line(party.email, `${key}-e`),
    line(party.trn ? `TRN ${party.trn}` : null, `${key}-t`),
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
      text(
        styles.companyName,
        company.tradeName || company.legalName,
        'cname',
      ),
      company.tradeName
        ? text(styles.companyLine, company.legalName, 'clegal')
        : null,
      line(company.address, 'caddr'),
      text(
        styles.companyLine,
        [company.phone, company.email].filter(Boolean).join('  ·  '),
        'ccontact',
      ),
      company.trn
        ? text(styles.companyLine, `TRN ${company.trn}`, 'ctrn')
        : null,
    ),
    el(
      View,
      { style: styles.docBlock },
      text(styles.docTitle, docTitle.toUpperCase(), 'dt'),
      text(styles.docNumber, docNumber, 'dn'),
      ...meta.map(([label, value], index) =>
        text(styles.docMeta, `${label}: ${value}`, `dm${index}`),
      ),
    ),
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
    showImages ? el(View, { style: styles.thumbHolder, key: 'h0' }) : null,
    text([styles.headCell, styles.cellDescription], 'DESCRIPTION', 'h1'),
    text([styles.headCell, styles.cellUnit], 'UNIT', 'h2'),
    text([styles.headCell, styles.cellQty], 'QTY', 'h3'),
    text([styles.headCell, styles.cellPrice], 'RATE', 'h4'),
    text([styles.headCell, styles.cellTotal], 'AMOUNT', 'h5'),
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
    el(
      View,
      { style: styles.section, key: 'cur' },
      text(styles.bodyText, `All amounts in ${currency}.`, 'curtext'),
    ),
  );
}

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
}

export function totalsBlock(
  rows: Array<[string, number]>,
  grand: [string, number],
  currency: string,
): ReactElement {
  return el(
    View,
    { style: styles.totals, wrap: false, minPresenceAhead: 72 },
    el(
      View,
      { style: styles.totalsBox },
      ...rows.map(([label, value], index) =>
        el(
          View,
          { style: styles.totalRow, key: `tr${index}` },
          text(styles.totalLabel, label, `trl${index}`),
          text(styles.totalValue, formatMoney(value, currency), `trv${index}`),
        ),
      ),
      el(
        View,
        { style: styles.grandRow, key: 'grand' },
        text(styles.grandLabel, grand[0], 'gl'),
        text(styles.grandValue, formatMoney(grand[1], currency), 'gv'),
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

export function keepTogether(
  children: Array<ReactElement | null>,
  minPresenceAhead = 120,
): ReactElement {
  return el(
    View,
    { wrap: false, minPresenceAhead },
    ...children.filter(Boolean),
  );
}

export function signatureBlock(company: PdfCompany): ReactElement {
  return el(
    View,
    { style: styles.signatureRow },
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
    text(styles.ctIntroLine, `To ${addressee}`, 'to'),
    data.contactPhone
      ? text(styles.ctIntroLine, `Contact ${data.contactPhone}`, 'phone')
      : null,
    data.location
      ? text(styles.ctIntroLine, `Location ${data.location}`, 'loc')
      : null,
    text(styles.ctIntroLine, 'Dear Sir/Madam,', 'salutation'),
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
  currency: string,
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
        'Amount (AED)',
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
    { style: styles.ctTotalsWrap, wrap: false, minPresenceAhead: 72 },
    el(
      View,
      { style: styles.ctTotalsBox },
      ...rows.map(([label, value], index) =>
        el(
          View,
          { style: styles.totalRow, key: `ctr${index}` },
          text(styles.totalLabel, label, `ctrl${index}`),
          text(styles.totalValue, formatMoney(value, currency), `ctrv${index}`),
        ),
      ),
      el(
        View,
        { style: styles.grandRow, key: 'ctgrand' },
        text(styles.grandLabel, grand[0], 'ctgl'),
        text(styles.grandValue, formatMoney(grand[1], currency), 'ctgv'),
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
    text(styles.genIntroLine, `Customer: ${data.customerName}`, 'cust'),
    data.contactPhone
      ? text(styles.genIntroLine, `Contact No: ${data.contactPhone}`, 'phone')
      : null,
    data.location
      ? text(styles.genIntroLine, `Location: ${data.location}`, 'loc')
      : null,
    data.subject?.trim()
      ? text(styles.genIntroLine, `Subject: ${data.subject.trim()}`, 'subj')
      : null,
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

export function generalLineTable(lines: PdfLine[]): ReactElement {
  const head = el(
    View,
    { style: styles.genTableHead, key: 'ghead' },
    text([styles.headCell, styles.genCellSn], 'S/N', 'gh0'),
    text([styles.headCell, styles.thumbHolder], 'PICTURE', 'gh1'),
    text([styles.headCell, styles.cellDescription], 'DESCRIPTION', 'gh2'),
    text([styles.headCell, styles.genCellQty], 'QTY', 'gh3'),
    text([styles.headCell, styles.genCellRate], 'RATE', 'gh4'),
    text([styles.headCell, styles.genCellTotal], 'TOTAL', 'gh5'),
  );

  const rows = lines.map((row, index) =>
    el(
      View,
      { style: styles.genRow, key: `gr${index}`, wrap: false },
      text(styles.genCellSn, String(index + 1), `gsn${index}`),
      el(
        View,
        { style: styles.thumbHolder, key: `gt${index}` },
        row.imageUrl
          ? el(Image, { style: styles.cellThumb, src: row.imageUrl })
          : null,
      ),
      text(
        [styles.cellDescription, styles.lineDescription],
        row.description,
        `gd${index}`,
      ),
      text(
        styles.genCellQty,
        `${formatQty(row.qty)} ${row.unit}`.trim(),
        `gq${index}`,
      ),
      text(styles.genCellRate, formatSectionAmount(row.unitPrice), `gp${index}`),
      text(styles.genCellTotal, formatSectionAmount(row.lineTotal), `ga${index}`),
    ),
  );

  return el(View, null, head, ...rows);
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
