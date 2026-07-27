import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { SupplierInput, SuppliersService } from './suppliers.service';

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
    @Body() body: SupplierInput,
  ) {
    if (!body?.name?.trim()) throw new BadRequestException('name is required');
    return this.service.create(session, { ...body, name: body.name.trim() });
  }

  @Put(':id')
  update(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() body: SupplierInput,
  ) {
    if (!body?.name?.trim()) throw new BadRequestException('name is required');
    return this.service.update(session, id, {
      ...body,
      name: body.name.trim(),
    });
  }

  @Delete(':id')
  remove(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.remove(session, id);
  }
}
