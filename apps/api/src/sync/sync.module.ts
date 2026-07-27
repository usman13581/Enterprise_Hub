import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { LedgerModule } from '../ledger/ledger.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [AuditModule, CommonModule, LedgerModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
