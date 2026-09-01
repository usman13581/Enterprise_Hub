import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { zodBody } from '../common/zod-validation.pipe';
import { lpoReceiptSchema, lpoSchema, purchaseInvoiceSchema, supplierPaymentSchema } from '@marble/types';
import { PurchasingService } from './purchasing.service';
import { ALLOWED_UPLOAD_MIME_TYPES, extensionForMime, isAllowedUploadMime, MAX_UPLOAD_BYTES, PRIVATE_UPLOADS_DIR } from '../uploads/uploads.constants';

@Controller()
@UseGuards(BootstrapAuthGuard)
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get('lpos')
  lpos(@CurrentSession() session: SessionContext, @Query('supplierId') supplierId?: string, @Query('status') status?: string) {
    return this.purchasing.listLpos(session, supplierId, status);
  }

  @Get('lpos/:id')
  lpo(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.purchasing.getLpo(session, id);
  }

  @Post('lpos')
  createLpo(@CurrentSession() session: SessionContext, @Body(zodBody(lpoSchema)) body: Parameters<PurchasingService['createLpo']>[1]) {
    return this.purchasing.createLpo(session, body);
  }

  @Patch('lpos/:id')
  updateLpo(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body() body: Partial<Parameters<PurchasingService['createLpo']>[1]>) {
    return this.purchasing.updateLpo(session, id, body);
  }

  @Post('lpos/:id/approve')
  approveLpo(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.purchasing.transitionLpo(session, id, 'approve');
  }

  @Post('lpos/:id/send')
  sendLpo(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.purchasing.transitionLpo(session, id, 'send');
  }

  @Post('lpos/:id/close')
  closeLpo(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.purchasing.transitionLpo(session, id, 'close');
  }

  @Post('lpos/:id/cancel')
  cancelLpo(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.purchasing.transitionLpo(session, id, 'cancel');
  }

  @Post('lpos/:id/receipts')
  receiveLpo(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body(zodBody(lpoReceiptSchema)) body: Parameters<PurchasingService['receiveLpo']>[2]) {
    return this.purchasing.receiveLpo(session, id, body);
  }

  @Get('purchase-invoices')
  purchaseInvoices(@CurrentSession() session: SessionContext, @Query('supplierId') supplierId?: string, @Query('status') status?: string) {
    return this.purchasing.listPurchaseInvoices(session, supplierId, status);
  }

  @Get('purchase-invoices/:id')
  purchaseInvoice(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.purchasing.getPurchaseInvoice(session, id);
  }

  @Post('purchase-invoices')
  createPurchaseInvoice(@CurrentSession() session: SessionContext, @Body(zodBody(purchaseInvoiceSchema)) body: Parameters<PurchasingService['createPurchaseInvoice']>[1]) {
    return this.purchasing.createPurchaseInvoice(session, body);
  }

  @Patch('purchase-invoices/:id')
  updatePurchaseInvoice(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body() body: Partial<Parameters<PurchasingService['createPurchaseInvoice']>[1]>) {
    return this.purchasing.updatePurchaseInvoice(session, id, body);
  }

  @Post('purchase-invoices/:id/attachment')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: PRIVATE_UPLOADS_DIR,
      filename: (_request, file, callback) => callback(null, `${randomUUID()}${extensionForMime(file.mimetype)}`),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_request, file, callback) => callback(null, isAllowedUploadMime(file.mimetype)),
  }))
  attachPurchaseInvoice(@CurrentSession() session: SessionContext, @Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException(`Attachment is required. Allowed: ${ALLOWED_UPLOAD_MIME_TYPES.join(', ')}`);
    return this.purchasing.attachPurchaseInvoice(session, id, file.filename);
  }

  @Get('purchase-invoices/:id/attachment')
  async purchaseInvoiceAttachment(@CurrentSession() session: SessionContext, @Param('id') id: string, @Res() response: Response) {
    const attachment = await this.purchasing.purchaseInvoiceAttachment(session, id);
    response.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    return response.sendFile(attachment.filePath);
  }

  @Post('purchase-invoices/:id/post')
  postPurchaseInvoice(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body() body: { allowVariance?: boolean; varianceReason?: string }) {
    return this.purchasing.postPurchaseInvoice(session, id, body);
  }

  @Post('purchase-invoices/:id/cancel')
  cancelPurchaseInvoice(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.purchasing.cancelPurchaseInvoice(session, id);
  }

  @Post('supplier-payments')
  createSupplierPayment(@CurrentSession() session: SessionContext, @Body(zodBody(supplierPaymentSchema)) body: Parameters<PurchasingService['createSupplierPayment']>[1]) {
    return this.purchasing.createSupplierPayment(session, body);
  }

  @Post('supplier-payments/:id/approve')
  approveSupplierPayment(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.purchasing.approveSupplierPayment(session, id);
  }

  @Get('supplier-payments')
  supplierPayments(@CurrentSession() session: SessionContext, @Query('supplierId') supplierId?: string) {
    return this.purchasing.listSupplierPayments(session, supplierId);
  }

  @Post('supplier-payments/:id/reverse')
  reverseSupplierPayment(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.purchasing.reverseSupplierPayment(session, id);
  }

  @Get('suppliers/:supplierId/statement')
  supplierStatement(@CurrentSession() session: SessionContext, @Param('supplierId') supplierId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.purchasing.supplierStatement(session, supplierId, from, to);
  }
}
