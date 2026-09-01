import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  creditNoteSchema,
  INVOICE_STATUSES,
  invoiceSchema,
  progressiveInvoiceSchema,
  type CreditNoteInput,
  type InvoiceInput,
  type InvoiceStatus,
  type ProgressiveInvoiceInput,
} from '@marble/types';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { zodBody } from '../common/zod-validation.pipe';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(BootstrapAuthGuard)
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get()
  list(
    @CurrentSession() session: SessionContext,
    @Query('customerId') customerId?: string,
    @Query('jobId') jobId?: string,
    @Query('status') status?: string,
  ) {
    const validStatus = INVOICE_STATUSES.includes(status as InvoiceStatus)
      ? (status as InvoiceStatus)
      : undefined;
    return this.service.list(session.companyId, {
      customerId,
      jobId,
      status: validStatus,
    });
  }

  /** Advances with a spare balance, for the allocation picker. */
  @Get('available-advances')
  availableAdvances(
    @CurrentSession() session: SessionContext,
    @Query('customerId') customerId: string,
    @Query('jobId') jobId?: string,
  ) {
    return this.service.availableAdvances(session.companyId, customerId, jobId);
  }

  @Get(':id')
  get(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.get(session.companyId, id);
  }

  @Post()
  create(
    @CurrentSession() session: SessionContext,
    @Body(zodBody(invoiceSchema)) body: InvoiceInput,
  ) {
    return this.service.create(session, body);
  }

  @Patch(':id')
  update(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(invoiceSchema)) body: InvoiceInput,
  ) {
    return this.service.update(session, id, body);
  }

  @Post(':id/issue')
  issue(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.issue(session, id);
  }

  @Post('jobs/:jobId/progressive')
  progressive(
    @CurrentSession() session: SessionContext,
    @Param('jobId') jobId: string,
    @Body(zodBody(progressiveInvoiceSchema)) body: ProgressiveInvoiceInput,
  ) {
    return this.service.createProgressive(session, jobId, body, 'progressive');
  }

  @Post('jobs/:jobId/custom')
  custom(
    @CurrentSession() session: SessionContext,
    @Param('jobId') jobId: string,
    @Body(zodBody(progressiveInvoiceSchema)) body: ProgressiveInvoiceInput,
  ) {
    return this.service.createProgressive(session, jobId, body, 'custom');
  }

  @Post('jobs/:jobId/final')
  final(
    @CurrentSession() session: SessionContext,
    @Param('jobId') jobId: string,
    @Body(zodBody(progressiveInvoiceSchema)) body: ProgressiveInvoiceInput,
  ) {
    return this.service.createFinal(session, jobId, body);
  }

  @Post('credit-notes')
  creditNote(
    @CurrentSession() session: SessionContext,
    @Body(zodBody(creditNoteSchema)) body: CreditNoteInput,
  ) {
    return this.service.createCreditNote(session, body);
  }

  @Post(':id/cancel')
  cancel(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.cancel(session, id);
  }
}
