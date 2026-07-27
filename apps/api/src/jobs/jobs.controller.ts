import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JOB_STATUSES, type JobStatus } from '@marble/types';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(BootstrapAuthGuard)
export class JobsController {
  constructor(private readonly service: JobsService) {}

  @Get()
  list(
    @CurrentSession() session: SessionContext,
    @Query('status') status?: string,
  ) {
    const valid = JOB_STATUSES.includes(status as JobStatus)
      ? (status as JobStatus)
      : undefined;
    return this.service.list(session.companyId, valid);
  }

  @Get(':id')
  get(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.get(session.companyId, id);
  }

  @Get(':id/hub')
  hub(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.hub(session.companyId, id);
  }

  @Post(':id/complete')
  complete(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.complete(session, id);
  }

  @Post(':id/close')
  close(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.service.close(session, id);
  }
}
