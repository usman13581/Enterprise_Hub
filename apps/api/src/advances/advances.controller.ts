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
import { advanceSchema, type AdvanceInput } from '@marble/types';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { zodBody } from '../common/zod-validation.pipe';
import { AdvancesService } from './advances.service';

@Controller('advances')
@UseGuards(BootstrapAuthGuard)
export class AdvancesController {
  constructor(private readonly service: AdvancesService) {}

  @Get()
  list(
    @CurrentSession() session: SessionContext,
    @Query('customerId') customerId?: string,
    @Query('jobId') jobId?: string,
  ) {
    return this.service.list(session.companyId, { customerId, jobId });
  }

  @Get(':id')
  get(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.get(session.companyId, id);
  }

  @Post()
  create(
    @CurrentSession() session: SessionContext,
    @Body(zodBody(advanceSchema)) body: AdvanceInput,
  ) {
    return this.service.create(session, body);
  }

  @Put(':id')
  update(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(advanceSchema)) body: AdvanceInput,
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

  @Delete(':id')
  remove(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.remove(session, id);
  }
}
