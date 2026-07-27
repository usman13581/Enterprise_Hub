import { renderToBuffer } from '@react-pdf/renderer';
import {
  AdvanceReceiptDocument,
  InvoiceDocument,
  QuotationDocument,
} from './documents';
import type {
  AdvanceReceiptPdfData,
  InvoicePdfData,
  QuotationPdfData,
} from './types';

export * from './types';
export { QuotationDocument, InvoiceDocument, AdvanceReceiptDocument };

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
