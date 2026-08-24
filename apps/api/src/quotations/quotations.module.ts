import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { QuotationLookupsController } from './quotation-lookups.controller';
import { QuotationLookupsService } from './quotation-lookups.service';

@Module({
  imports: [PrismaModule, AuditModule, CommonModule],
  controllers: [QuotationsController, QuotationLookupsController],
  providers: [QuotationsService, QuotationLookupsService],
  exports: [QuotationsService, QuotationLookupsService],
})
export class QuotationsModule {}
