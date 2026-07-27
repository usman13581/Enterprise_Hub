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
    { style: styles.totals },
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

export function footer(company: PdfCompany, extra?: string): ReactElement {
  const parts = [
    company.legalName,
    company.trn ? `TRN ${company.trn}` : null,
    extra,
  ].filter(Boolean);
  return el(Text, { style: styles.footer, fixed: true }, parts.join('   ·   '));
}
