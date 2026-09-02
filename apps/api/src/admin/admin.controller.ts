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
import { z } from 'zod';
import { zodBody } from '../common/zod-validation.pipe';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import {
  SessionContext,
  requirePlatformSession,
} from '../auth/session.types';
import { AdminService } from './admin.service';
import { CompanyDeletionService } from './company-deletion.service';
import { DemoProvisioningService } from '../public/demo-provisioning.service';
import { AuthService } from '../auth/auth.service';

const companySchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(100).optional(),
});
const companyUpdateSchema = companySchema.partial().extend({
  industryCategoryId: z.string().trim().min(1).nullable().optional(),
});
const userSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  password: z.string().min(12).max(200),
  companyRole: z.enum(['admin', 'member']),
  accessExpiresAt: z.string().trim().min(1).nullable().optional(),
});
const userUpdateSchema = z.object({
  active: z.boolean().optional(),
  companyRole: z.enum(['admin', 'member']).optional(),
  accessExpiresAt: z.string().trim().min(1).nullable().optional(),
  password: z.string().min(12).max(200).optional(),
});
const planSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(50),
  interval: z.enum(['month', 'monthly', 'year', 'yearly']).optional(),
  priceUsd: z.number().finite().nonnegative().optional(),
  trialDays: z.number().int().nonnegative().optional(),
  maxUsers: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});
const subscriptionSchema = z.object({
  planId: z.string().min(1),
  status: z.enum(['trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired']).optional(),
  startsAt: z.string().min(1).optional(),
  trialEndsAt: z.string().min(1).nullable().optional(),
  expiresAt: z.string().min(1).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  seatsOverride: z.number().int().nonnegative().nullable().optional(),
});
const paymentSchema = z.object({
  amount: z.number().finite().nonnegative(),
  paidAt: z.string().min(1),
  reference: z.string().trim().max(200).optional(),
  extendExpiresAt: z.string().min(1).optional(),
});
const renewalApproveSchema = z.object({
  expiresAt: z.string().min(1).optional(),
});
const renewalRejectSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
const applicationApproveSchema = z.object({
  planId: z.string().min(1),
  ownerPassword: z.string().min(12).max(200),
  trialDays: z.number().int().nonnegative().optional(),
  slug: z.string().trim().max(100).optional(),
  industryCategoryId: z.string().trim().min(1).nullable().optional(),
});
const applicationRejectSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
const notificationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  companyIds: z.union([z.literal('all'), z.array(z.string().min(1))]).optional(),
  audience: z.enum(['company_admins', 'all_users']),
});
const supportCloseSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

const companyDeleteSchema = z.object({
  confirmation: z.string().trim().min(1).max(300),
});

@Controller('admin')
@UseGuards(PlatformAdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly demos: DemoProvisioningService,
    private readonly auth: AuthService,
    private readonly companyDeletion: CompanyDeletionService,
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
  createCompany(@Body(zodBody(companySchema)) body: { name: string; slug?: string }) {
    return this.admin.createCompany(body);
  }

  @Get('companies/:id')
  getCompany(@Param('id') id: string) {
    return this.admin.getCompany(id);
  }

  @Post('companies/:id/workspace')
  openWorkspace(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
  ) {
    return this.auth.createReadOnlyCompanySession(
      requirePlatformSession(session),
      id,
    );
  }

  @Patch('companies/:id')
  updateCompany(
    @Param('id') id: string,
    @Body(zodBody(companyUpdateSchema))
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

  @Get('companies/:id/delete-preview')
  deletePreview(@Param('id') id: string) {
    return this.companyDeletion.preview(id);
  }

  @Post('companies/:id/delete')
  deleteCompany(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(companyDeleteSchema)) body: { confirmation: string },
  ) {
    return this.companyDeletion.deleteCompletely(
      id,
      body.confirmation,
      requirePlatformSession(session),
    );
  }

  @Get('companies/:id/users')
  listUsers(@Param('id') id: string) {
    return this.admin.listCompanyUsers(id);
  }

  @Post('companies/:id/users')
  createUser(
    @Param('id') id: string,
    @Body(zodBody(userSchema))
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
    @Body(zodBody(userUpdateSchema))
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
    @Body(zodBody(planSchema))
    body: {
      name: string;
      code: string;
      interval?: string;
      priceUsd?: number;
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
    @Body(zodBody(planSchema.partial()))
    body: {
      name?: string;
      code?: string;
      interval?: string;
      priceUsd?: number;
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
    @Body(zodBody(subscriptionSchema))
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
    @Body(zodBody(paymentSchema))
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
    @Body(zodBody(renewalApproveSchema)) body: { expiresAt?: string },
  ) {
    return this.admin.approveRenewal(id, requirePlatformSession(session), body);
  }

  @Post('renewal-requests/:id/reject')
  rejectRenewal(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(renewalRejectSchema)) body: { reason: string },
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
    @Body(zodBody(applicationApproveSchema))
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
    @Body(zodBody(applicationRejectSchema)) body: { reason: string },
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
    @Body(zodBody(notificationSchema))
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
    @Body(zodBody(supportCloseSchema)) body: { note?: string },
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
