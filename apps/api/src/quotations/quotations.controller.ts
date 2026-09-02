import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  QUOTATION_STATUSES,
  quotationSchema,
  type QuotationInput,
  type QuotationStatus,
} from '@marble/types';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { zodBody } from '../common/zod-validation.pipe';
import { QuotationsService } from './quotations.service';

@Controller('quotations')
@UseGuards(BootstrapAuthGuard)
export class QuotationsController {
  constructor(private readonly service: QuotationsService) {}

  @Get()
  list(
    @CurrentSession() session: SessionContext,
    @Query('status') status?: string,
  ) {
    const valid = QUOTATION_STATUSES.includes(status as QuotationStatus)
      ? (status as QuotationStatus)
      : undefined;
    return this.service.list(session.companyId, valid);
  }

  @Get(':id')
  get(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.get(session.companyId, id);
  }

  @Post()
  create(
    @CurrentSession() session: SessionContext,
    @Body(zodBody(quotationSchema)) body: QuotationInput,
  ) {
    return this.service.create(session, body);
  }

  @Put(':id')
  update(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(quotationSchema)) body: QuotationInput,
  ) {
    return this.service.update(session, id, body);
  }

  @Post(':id/approve')
  approve(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.approve(session, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.cancel(session, id);
  }

  @Post(':id/revise')
  revise(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.revise(session, id);
  }

  @Post(':id/copy')
  copyAsNew(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.copyAsNew(session, id);
  }

  @Delete(':id')
  remove(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.remove(session, id);
  }
}
