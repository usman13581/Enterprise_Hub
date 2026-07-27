import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(BootstrapAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @CurrentSession() session: SessionContext,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.list(session.companyId, Number(limit) || 50);
  }
}
