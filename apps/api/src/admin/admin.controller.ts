import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ForbiddenException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import {
  SessionContext,
  requirePlatformSession,
} from '../auth/session.types';
import { AdminService } from './admin.service';
import { DemoProvisioningService } from '../public/demo-provisioning.service';

@Controller('admin')
@UseGuards(PlatformAdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly demos: DemoProvisioningService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('companies')
  listCompanies() {
    return this.admin.listCompanies();
  }

  @Post('companies')
  createCompany(@Body() body: { name: string; slug?: string }) {
    return this.admin.createCompany(body);
  }

  @Get('companies/:id')
  getCompany(@Param('id') id: string) {
    return this.admin.getCompany(id);
  }

  @Patch('companies/:id')
  updateCompany(
    @Param('id') id: string,
    @Body()
    body: { name?: string; slug?: string; industryCategoryId?: string | null },
  ) {
    return this.admin.updateCompany(id, body);
  }

  @Post('companies/:id/suspend')
  suspend(@Param('id') id: string) {
    return this.admin.suspendCompany(id);
  }

  @Post('companies/:id/unsuspend')
  unsuspend(@Param('id') id: string) {
    return this.admin.unsuspendCompany(id);
  }

  @Get('companies/:id/users')
  listUsers(@Param('id') id: string) {
    return this.admin.listCompanyUsers(id);
  }

  @Post('companies/:id/users')
  createUser(
    @Param('id') id: string,
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      companyRole: 'admin' | 'member';
      accessExpiresAt?: string | null;
    },
  ) {
    return this.admin.createCompanyUser(id, body);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body()
    body: {
      active?: boolean;
      companyRole?: 'admin' | 'member';
      accessExpiresAt?: string | null;
      password?: string;
    },
  ) {
    return this.admin.updateUser(id, body);
  }

  @Get('plans')
  listPlans() {
    return this.admin.listPlans();
  }

  @Post('plans')
  createPlan(
    @Body()
    body: {
      name: string;
      code: string;
      interval?: string;
      priceAed?: number;
      trialDays?: number;
      maxUsers?: number;
      active?: boolean;
    },
  ) {
    return this.admin.createPlan(body);
  }

  @Patch('plans/:id')
  updatePlan(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      code?: string;
      interval?: string;
      priceAed?: number;
      trialDays?: number;
      maxUsers?: number;
      active?: boolean;
    },
  ) {
    return this.admin.updatePlan(id, body);
  }

  @Get('companies/:id/subscription')
  getSubscription(@Param('id') id: string) {
    return this.admin.getSubscription(id);
  }

  @Patch('companies/:id/subscription')
  upsertSubscription(
    @Param('id') id: string,
    @Body()
    body: {
      planId: string;
      status?: string;
      startsAt?: string;
      trialEndsAt?: string | null;
      expiresAt?: string | null;
      note?: string | null;
      seatsOverride?: number | null;
    },
  ) {
    return this.admin.upsertSubscription(id, body);
  }

  @Post('companies/:id/subscription/manual-payment')
  manualPayment(
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      paidAt: string;
      reference?: string;
      extendExpiresAt?: string;
    },
  ) {
    return this.admin.manualPayment(id, body);
  }

  @Get('renewal-requests')
  listRenewals() {
    return this.admin.listRenewalRequests();
  }

  @Get('renewal-requests/:id')
  getRenewal(@Param('id') id: string) {
    return this.admin.getRenewalRequest(id);
  }

  @Post('renewal-requests/:id/approve')
  approveRenewal(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() body: { expiresAt?: string },
  ) {
    return this.admin.approveRenewal(id, requirePlatformSession(session), body);
  }

  @Post('renewal-requests/:id/reject')
  rejectRenewal(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.admin.rejectRenewal(id, requirePlatformSession(session), body);
  }

  @Get('applications')
  listApplications(@Query('status') status?: string) {
    return this.admin.listApplications(status);
  }

  @Get('applications/:id')
  getApplication(@Param('id') id: string) {
    return this.admin.getApplication(id);
  }

  @Get('demo-requests/:id/credentials')
  demoCredentials(@Param('id') id: string) {
    return this.demos.revealCredentials(id);
  }

  @Post('demo-requests/cleanup')
  cleanupDemos(@Query('dryRun') dryRun?: string) {
    const isDryRun = dryRun === 'true';
    if (!isDryRun && process.env.DEMO_CLEANUP_ENABLED !== 'true') {
      throw new ForbiddenException(
        'Destructive demo cleanup is disabled until DEMO_CLEANUP_ENABLED=true.',
      );
    }
    return this.demos.cleanupExpired({ dryRun: isDryRun });
  }

  @Post('applications/:id/approve')
  approveApplication(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body()
    body: {
      planId: string;
      ownerPassword: string;
      trialDays?: number;
      slug?: string;
      industryCategoryId?: string | null;
    },
  ) {
    return this.admin.approveApplication(
      id,
      requirePlatformSession(session),
      body,
    );
  }

  @Post('applications/:id/reject')
  rejectApplication(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.admin.rejectApplication(
      id,
      requirePlatformSession(session),
      body,
    );
  }

  @Post('notifications')
  sendNotification(
    @CurrentSession() session: SessionContext,
    @Body()
    body: {
      title: string;
      body: string;
      companyIds?: string[] | 'all';
      audience: 'company_admins' | 'all_users';
    },
  ) {
    return this.admin.sendNotification(
      requirePlatformSession(session),
      body,
    );
  }

  @Get('notifications')
  listNotifications(@Query('limit') limit?: string) {
    return this.admin.listNotifications(Number(limit) || 50);
  }

  @Get('support/requests')
  listSupport(
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listSupportRequests({ companyId, status });
  }

  @Get('support/requests/:id')
  getSupport(@Param('id') id: string) {
    return this.admin.getSupportRequest(id);
  }

  @Post('support/requests/:id/close')
  closeSupport(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    return this.admin.closeSupportRequest(
      id,
      requirePlatformSession(session),
      body,
    );
  }

  @Get('audit')
  audit(
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listAudit({
      companyId,
      limit: Number(limit) || 50,
    });
  }

  @Get('industry-categories')
  industryCategories() {
    return this.admin.listIndustryCategories();
  }
}
