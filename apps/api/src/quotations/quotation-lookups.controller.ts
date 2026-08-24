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
  QUOTATION_LOOKUP_CATEGORIES,
  quotationLookupSchema,
  type QuotationLookupCategory,
  type QuotationLookupInput,
} from '@marble/types';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { zodBody } from '../common/zod-validation.pipe';
import { QuotationLookupsService } from './quotation-lookups.service';

@Controller('quotation-lookups')
@UseGuards(BootstrapAuthGuard)
export class QuotationLookupsController {
  constructor(private readonly service: QuotationLookupsService) {}

  @Get()
  list(
    @CurrentSession() session: SessionContext,
    @Query('category') category?: string,
    @Query('appliesTo') appliesTo?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const validCategory = QUOTATION_LOOKUP_CATEGORIES.includes(
      category as QuotationLookupCategory,
    )
      ? (category as QuotationLookupCategory)
      : undefined;
    return this.service.list(session.companyId, {
      category: validCategory,
      appliesTo: appliesTo || undefined,
      activeOnly: activeOnly === '1' || activeOnly === 'true',
    });
  }

  @Post()
  create(
    @CurrentSession() session: SessionContext,
    @Body(zodBody(quotationLookupSchema)) body: QuotationLookupInput,
  ) {
    return this.service.create(session, body);
  }

  @Put(':id')
  update(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(quotationLookupSchema)) body: QuotationLookupInput,
  ) {
    return this.service.update(session, id, body);
  }

  @Delete(':id')
  remove(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.remove(session, id);
  }
}
