import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import {
  CompanyNotificationsController,
  CompanyPlatformController,
  CompanySupportController,
} from './company-platform.controller';
import { CompanyService } from './company.service';
import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PublicModule } from '../public/public.module';

@Module({
  imports: [AuditModule, LedgerModule, PublicModule],
  controllers: [
    CompanyController,
    CompanyPlatformController,
    CompanyNotificationsController,
    CompanySupportController,
  ],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
