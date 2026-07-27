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
import { ProductInput, ProductsService } from './products.service';

@Controller('products')
@UseGuards(BootstrapAuthGuard)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

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
    @Body() body: ProductInput,
  ) {
    if (!body?.name?.trim()) throw new BadRequestException('name is required');
    return this.service.create(session, { ...body, name: body.name.trim() });
  }

  @Put(':id')
  update(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() body: ProductInput,
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

  @Post(':id/images')
  addImage(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() body: { url?: string },
  ) {
    if (!body?.url?.trim()) throw new BadRequestException('url is required');
    return this.service.addImage(session, id, body.url.trim());
  }

  @Put(':id/images/:imageId/default')
  setDefault(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.service.setDefaultImage(session, id, imageId);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.service.removeImage(session, id, imageId);
  }
}
