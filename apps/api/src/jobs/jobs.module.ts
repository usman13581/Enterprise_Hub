import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ExpiryNoticesService } from './expiry-notices.service';

@Module({
  imports: [PrismaModule, AuditModule, LedgerModule],
  controllers: [JobsController],
  providers: [JobsService, ExpiryNoticesService],
  exports: [JobsService],
})
export class JobsModule {}
