import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(BootstrapAuthGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get('quotations/:id.pdf')
  async quotation(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.quotationPdf(
      session.companyId,
      id,
    );
    this.send(res, buffer, filename);
  }

  @Get('invoices/:id.pdf')
  async invoice(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.invoicePdf(
      session.companyId,
      id,
    );
    this.send(res, buffer, filename);
  }

  @Get('advances/:id.pdf')
  async advance(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.advanceReceiptPdf(
      session.companyId,
      id,
    );
    this.send(res, buffer, filename);
  }

  @Get('purchase-invoices/:id.pdf')
  async purchaseInvoice(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.purchaseInvoicePdf(
      session.companyId,
      id,
    );
    this.send(res, buffer, filename);
  }

  @Get('lpos/:id.pdf')
  async lpo(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.lpoPdf(
      session.companyId,
      id,
    );
    this.send(res, buffer, filename);
  }

  private send(res: Response, buffer: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.end(buffer);
  }
}
