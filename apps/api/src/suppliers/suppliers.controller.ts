import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { supplierSchema, type SupplierInput } from '@marble/types';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { zodBody } from '../common/zod-validation.pipe';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
@UseGuards(BootstrapAuthGuard)
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  list(@CurrentSession() session: SessionContext) {
    return this.service.list(session.companyId);
  }

  @Get(':id')
  get(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.get(session.companyId, id);
  }

  @Post()
  create(
    @CurrentSession() session: SessionContext,
    @Body(zodBody(supplierSchema)) body: SupplierInput,
  ) {
    return this.service.create(session, body);
  }

  @Put(':id')
  update(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(supplierSchema)) body: SupplierInput,
  ) {
    return this.service.update(session, id, body);
  }

  @Delete(':id')
  remove(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.remove(session, id);
  }
}
