import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { syncPushSchema, type SyncPushInput } from '@marble/types';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { zodBody } from '../common/zod-validation.pipe';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(BootstrapAuthGuard)
export class SyncController {
  constructor(private readonly service: SyncService) {}

  /**
   * Incremental pull. Pass `since` as an ISO timestamp from the previous
   * response's `serverTime` (or omit for a full snapshot).
   */
  @Get('pull')
  pull(
    @CurrentSession() session: SessionContext,
    @Query('since') since?: string,
  ) {
    return this.service.pull(session.companyId, since);
  }

  /** Apply offline mutations with conflict decisions returned per item. */
  @Post('push')
  push(
    @CurrentSession() session: SessionContext,
    @Body(zodBody(syncPushSchema)) body: SyncPushInput,
  ) {
    return this.service.push(session, body);
  }
}
