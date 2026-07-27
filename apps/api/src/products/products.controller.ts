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
import { z } from 'zod';
import { productSchema, type ProductInput } from '@marble/types';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { zodBody } from '../common/zod-validation.pipe';
import { ProductsService } from './products.service';

const imageSchema = z.object({ url: z.string().trim().min(1).max(1000) });

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
    @Body(zodBody(productSchema)) body: ProductInput,
  ) {
    return this.service.create(session, body);
  }

  @Put(':id')
  update(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(productSchema)) body: ProductInput,
  ) {
    return this.service.update(session, id, body);
  }

  @Delete(':id')
  remove(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.remove(session, id);
  }

  @Post(':id/images')
  addImage(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(imageSchema)) body: z.infer<typeof imageSchema>,
  ) {
    return this.service.addImage(session, id, body.url);
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
