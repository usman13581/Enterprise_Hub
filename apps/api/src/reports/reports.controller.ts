import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import type { ReportQuery } from './report.types';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(BootstrapAuthGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get()
  shell(@CurrentSession() _session: SessionContext) {
    return this.service.shell();
  }

  @Get('invoices/:view/pdf')
  async invoicePdf(
    @CurrentSession() session: SessionContext,
    @Param('view') view: string,
    @Query() query: ReportQuery,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.invoicePdf(
      session.companyId,
      view,
      query,
    );
    this.send(res, buffer, filename);
  }

  @Get('invoices/:view')
  invoiceReport(
    @CurrentSession() session: SessionContext,
    @Param('view') view: string,
    @Query() query: ReportQuery,
  ) {
    return this.service.runInvoice(session.companyId, view, query);
  }

  @Get(':key/pdf')
  async pdf(
    @CurrentSession() session: SessionContext,
    @Param('key') key: string,
    @Query() query: ReportQuery,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.pdf(
      session.companyId,
      key,
      query,
    );
    this.send(res, buffer, filename);
  }

  @Get(':key')
  report(
    @CurrentSession() session: SessionContext,
    @Param('key') key: string,
    @Query() query: ReportQuery,
  ) {
    return this.service.run(session.companyId, key, query);
  }

  private send(res: Response, buffer: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.end(buffer);
  }
}
