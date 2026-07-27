import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AdvancesController } from './advances.controller';
import { AdvancesService } from './advances.service';

@Module({
  imports: [PrismaModule, AuditModule, CommonModule, LedgerModule],
  controllers: [AdvancesController],
  providers: [AdvancesService],
  exports: [AdvancesService],
})
export class AdvancesModule {}
