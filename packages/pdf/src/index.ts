import { renderToBuffer } from '@react-pdf/renderer';
import {
  AdvanceReceiptDocument,
  InvoiceDocument,
  QuotationDocument,
  ReportDocument,
} from './documents';
import type {
  AdvanceReceiptPdfData,
  InvoicePdfData,
  QuotationPdfData,
  ReportPdfData,
} from './types';

export * from './types';
export {
  QuotationDocument,
  InvoiceDocument,
  AdvanceReceiptDocument,
  ReportDocument,
};

export function renderQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
  return renderToBuffer(QuotationDocument(data));
}

export function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(InvoiceDocument(data));
}

export function renderAdvanceReceiptPdf(
  data: AdvanceReceiptPdfData,
): Promise<Buffer> {
  return renderToBuffer(AdvanceReceiptDocument(data));
}

export function renderReportPdf(data: ReportPdfData): Promise<Buffer> {
  return renderToBuffer(ReportDocument(data));
}
