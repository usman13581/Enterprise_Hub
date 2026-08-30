import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CompanyAdminGuard } from '../auth/company-admin.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import {
  SessionContext,
  requireCompanySession,
} from '../auth/session.types';
import { CompanyService } from './company.service';
import { DemoProvisioningService } from '../public/demo-provisioning.service';

@Controller('company')
export class CompanyPlatformController {
  constructor(
    private readonly company: CompanyService,
    private readonly demos: DemoProvisioningService,
  ) {}

  @Get('dashboard')
  @UseGuards(CompanyAdminGuard)
  dashboard(@CurrentSession() session: SessionContext) {
    return this.company.dashboard(requireCompanySession(session));
  }

  @Get('users')
  @UseGuards(CompanyAdminGuard)
  listUsers(@CurrentSession() session: SessionContext) {
    const s = requireCompanySession(session);
    return this.company.listUsers(s.companyId);
  }

  @Patch('users/:id')
  @UseGuards(CompanyAdminGuard)
  patchUser(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    return this.company.setUserActive(
      requireCompanySession(session),
      id,
      !!body.active,
    );
  }

  @Get('subscription/renewal-requests')
  @UseGuards(CompanyAdminGuard)
  listRenewals(@CurrentSession() session: SessionContext) {
    const s = requireCompanySession(session);
    return this.company.listRenewalRequests(s.companyId);
  }

  @Post('subscription/renewal-requests')
  @UseGuards(CompanyAdminGuard)
  createRenewal(
    @CurrentSession() session: SessionContext,
    @Body()
    body: {
      amount: number;
      paidAt: string;
      bankReference?: string;
      notes?: string;
      depositDocumentUrl: string;
    },
  ) {
    return this.company.createRenewalRequest(
      requireCompanySession(session),
      body,
    );
  }

  @Post('subscription/cancel-trial')
  @UseGuards(CompanyAdminGuard)
  cancelTrial(@CurrentSession() session: SessionContext) {
    return this.demos.cancelTrial(requireCompanySession(session).companyId);
  }
}

@Controller('notifications')
@UseGuards(BootstrapAuthGuard)
export class CompanyNotificationsController {
  constructor(private readonly company: CompanyService) {}

  @Get('unread-count')
  unreadCount(@CurrentSession() session: SessionContext) {
    return this.company.unreadNotificationCount(
      requireCompanySession(session),
    );
  }

  @Get()
  list(@CurrentSession() session: SessionContext) {
    return this.company.listNotifications(requireCompanySession(session));
  }

  @Post(':id/read')
  markRead(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
  ) {
    return this.company.markNotificationRead(
      requireCompanySession(session),
      id,
    );
  }

  @Post()
  @UseGuards(CompanyAdminGuard)
  create(
    @CurrentSession() session: SessionContext,
    @Body()
    body: {
      title: string;
      body: string;
      audience: 'all_users' | 'one_user';
      userId?: string;
    },
  ) {
    return this.company.createCompanyNotification(
      requireCompanySession(session),
      body,
    );
  }
}

@Controller('support/requests')
@UseGuards(BootstrapAuthGuard)
export class CompanySupportController {
  constructor(private readonly company: CompanyService) {}

  @Get()
  list(
    @CurrentSession() session: SessionContext,
    @Query('status') status?: string,
  ) {
    const s = requireCompanySession(session);
    const st =
      status === 'closed' || status === 'all' || status === 'open'
        ? status
        : 'open';
    return this.company.listSupportRequests(s, st);
  }

  @Get(':id')
  get(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    const s = requireCompanySession(session);
    return this.company.getSupportRequest(s, id);
  }

  @Post()
  create(
    @CurrentSession() session: SessionContext,
    @Body() body: { title: string; body: string; attachmentUrl?: string },
  ) {
    return this.company.createSupportRequest(
      requireCompanySession(session),
      body,
    );
  }

  @Post(':id/close')
  @UseGuards(CompanyAdminGuard)
  close(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    return this.company.closeSupportRequest(
      requireCompanySession(session),
      id,
      body,
    );
  }
}
