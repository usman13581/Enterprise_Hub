import { Injectable, NotFoundException } from '@nestjs/common';
import {
  renderAdvanceReceiptPdf,
  renderInvoicePdf,
  renderQuotationPdf,
  type PdfCompany,
  type PdfParty,
} from '@marble/pdf';
import { UAE_VAT_RATE } from '@marble/domain';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async quotationPdf(companyId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: {
              include: { images: { where: { isDefault: true }, take: 1 } },
            },
          },
        },
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');

    const company = await this.company(companyId);

    const buffer = await renderQuotationPdf({
      company,
      customer: this.party(quotation.customer),
      number: quotation.number,
      status: quotation.status,
      createdAt: quotation.createdAt.toISOString(),
      validUntil: quotation.validUntil?.toISOString() ?? null,
      title: quotation.title,
      notes: quotation.notes,
      vatRate: await this.vatRate(companyId),
      subtotal: quotation.subtotal,
      vatAmount: quotation.vatAmount,
      total: quotation.total,
      lines: quotation.lines.map((line) => ({
        description: line.description,
        unit: line.unit,
        qty: line.qty,
        unitPrice: line.sellPrice,
        lineTotal: line.lineTotal,
        imageUrl: this.absolute(line.product?.images?.[0]?.url),
      })),
    });

    return { buffer, filename: `quotation-${quotation.number}.pdf` };
  }

  async invoicePdf(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        job: { select: { number: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        allocations: { include: { advance: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const company = await this.company(companyId);

    const buffer = await renderInvoicePdf({
      company,
      customer: this.party(invoice.customer),
      number: invoice.number,
      kind: invoice.kind,
      status: invoice.status,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate?.toISOString() ?? null,
      jobNumber: invoice.job?.number ?? null,
      notes: invoice.notes,
      vatRate: await this.vatRate(companyId),
      subtotal: invoice.subtotal,
      vatAmount: invoice.vatAmount,
      total: invoice.total,
      advanceApplied: invoice.advanceApplied,
      netPayable: invoice.netPayable,
      lines: invoice.lines.map((line) => ({
        description: line.description,
        unit: line.unit,
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
      allocations: invoice.allocations.map((allocation) => ({
        number: allocation.advance.number,
        amount: allocation.amount,
        receivedAt: allocation.advance.receivedAt.toISOString(),
      })),
    });

    const prefix = invoice.kind === 'credit_note' ? 'credit-note' : 'invoice';
    return { buffer, filename: `${prefix}-${invoice.number}.pdf` };
  }

  async advanceReceiptPdf(companyId: string, id: string) {
    const advance = await this.prisma.advancePayment.findFirst({
      where: { id, companyId },
      include: { customer: true, job: { select: { number: true } } },
    });
    if (!advance) throw new NotFoundException('Advance not found');

    const buffer = await renderAdvanceReceiptPdf({
      company: await this.company(companyId),
      customer: this.party(advance.customer),
      number: advance.number,
      amount: advance.amount,
      method: advance.method,
      reference: advance.reference,
      receivedAt: advance.receivedAt.toISOString(),
      jobNumber: advance.job?.number ?? null,
      notes: advance.notes,
    });

    return { buffer, filename: `advance-receipt-${advance.number}.pdf` };
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

  private async vatRate(companyId: string): Promise<number> {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { vatRate: true },
    });
    return profile?.vatRate ?? UAE_VAT_RATE;
  }

  private party(party: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    trn: string | null;
  }): PdfParty {
    return {
      name: party.name,
      address: party.address,
      phone: party.phone,
      email: party.email,
      trn: party.trn,
    };
  }

  /**
   * Uploads are stored as /static paths. The PDF renderer fetches images itself,
   * so it needs an absolute URL it can resolve from inside the API process.
   */
  private absolute(url?: string | null): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    const base =
      process.env.PUBLIC_API_URL?.replace(/\/$/, '') ||
      `http://127.0.0.1:${process.env.PORT ?? 3001}`;
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }
}
