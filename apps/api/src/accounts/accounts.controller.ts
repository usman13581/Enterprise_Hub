import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { AccountsService } from './accounts.service';

@Controller('accounts')
@UseGuards(BootstrapAuthGuard)
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get('overview')
  overview(@CurrentSession() session: SessionContext) {
    return this.service.overview(session.companyId);
  }

  @Get('customers/:customerId/ledger')
  customerLedger(
    @CurrentSession() session: SessionContext,
    @Param('customerId') customerId: string,
  ) {
    return this.service.customerLedger(session.companyId, customerId);
  }

  @Get('jobs/:jobId/ledger')
  jobLedger(
    @CurrentSession() session: SessionContext,
    @Param('jobId') jobId: string,
  ) {
    return this.service.jobLedger(session.companyId, jobId);
  }
}
