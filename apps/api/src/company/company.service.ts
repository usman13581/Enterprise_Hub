import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  currencyForCountry,
  DEFAULT_COUNTRY_CODE,
  normalizeCountryCode,
  type CompanyProfileInput,
} from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuthService } from '../auth/auth.service';
import {
  CompanySessionContext,
  SessionContext,
  requireCompanySession,
} from '../auth/session.types';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly auth: AuthService,
  ) {}

  async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        profile: true,
        industryCategory: {
          include: {
            features: { include: { feature: true } },
          },
        },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    const features = await this.auth.featuresForCompany(companyId);
    return { ...company, features };
  }

  async updateProfile(session: SessionContext, input: CompanyProfileInput) {
    const s = requireCompanySession(session);
    const before = await this.prisma.companyProfile.findUnique({
      where: { companyId: s.companyId },
    });
    if (!before) throw new NotFoundException('Company profile not found');

    const nextCountry =
      normalizeCountryCode(input.country) ??
      before.country ??
      DEFAULT_COUNTRY_CODE;
    const nextCurrency = currencyForCountry(nextCountry);
    const currencyChanged = nextCurrency !== before.currency;

    const profile = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.companyProfile.update({
        where: { companyId: s.companyId },
        data: {
          legalName: input.legalName?.trim() || before.legalName,
          tradeName: input.tradeName ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          trn: input.trn ?? null,
          bankDetails: input.bankDetails ?? null,
          logoUrl: input.logoUrl ?? null,
          signatureUrl: input.signatureUrl ?? null,
          quotationPrefix:
            input.quotationPrefix?.trim() || before.quotationPrefix,
          invoicePrefix: input.invoicePrefix?.trim() || before.invoicePrefix,
          jobPrefix: input.jobPrefix?.trim() || before.jobPrefix,
          advancePrefix: input.advancePrefix?.trim() || before.advancePrefix,
          creditNotePrefix:
            input.creditNotePrefix?.trim() || before.creditNotePrefix,
          country: nextCountry,
          currency: nextCurrency,
        },
      });

      const companyPatch: {
        name?: string;
        dataEpoch?: { increment: number };
      } = {};
      if (input.tradeName?.trim()) {
        companyPatch.name = input.tradeName.trim();
      }
      if (currencyChanged) {
        companyPatch.dataEpoch = { increment: 1 };
        await tx.lpo.updateMany({
          where: { companyId: s.companyId },
          data: { currency: nextCurrency },
        });
        await tx.purchaseInvoice.updateMany({
          where: { companyId: s.companyId },
          data: { currency: nextCurrency },
        });
        await tx.supplierPriceHistory.updateMany({
          where: { companyId: s.companyId },
          data: { currency: nextCurrency },
        });
        await tx.hRPolicyProfile.updateMany({
          where: { companyId: s.companyId },
          data: { currency: nextCurrency },
        });
        await tx.hRSalaryProfile.updateMany({
          where: { companyId: s.companyId },
          data: { currency: nextCurrency },
        });
      }
      if (Object.keys(companyPatch).length > 0) {
        await tx.company.update({
          where: { id: s.companyId },
          data: companyPatch,
        });
      }
      return updated;
    });

    await this.audit.write({
      companyId: s.companyId,
      actorId: s.userId,
      entityType: 'CompanyProfile',
      entityId: profile.id,
      action: 'update',
      before,
      after: profile,
    });

    return this.getCompany(s.companyId);
  }

  async getSubscription(companyId: string) {
    const sub = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!sub) {
      return null;
    }
    return {
      planName: sub.plan.name,
      planCode: sub.plan.code,
      status: sub.status,
      isDemo: sub.isDemo,
      demoCleanupStatus: sub.demoCleanupStatus,
      startsAt: sub.startsAt,
      trialEndsAt: sub.trialEndsAt,
      expiresAt: sub.expiresAt,
      seatsIncluded: sub.seatsIncluded,
      seatsOverride: sub.seatsOverride,
      seats: sub.seatsOverride ?? sub.seatsIncluded,
      lastPaymentAmount: sub.lastPaymentAmount,
      lastPaymentAt: sub.lastPaymentAt,
    };
  }

  async dashboard(session: CompanySessionContext) {
    const companyId = session.companyId;
    const now = new Date();

    const [
      subscription,
      activeUsers,
      deactivatedUsers,
      openQuotations,
      openJobs,
      outstandingInvoices,
      overdueInvoices,
      unreadNotifications,
      openSupport,
      money,
    ] = await Promise.all([
      this.getSubscription(companyId),
      this.prisma.user.count({ where: { companyId, active: true } }),
      this.prisma.user.count({ where: { companyId, active: false } }),
      this.prisma.quotation.count({
        where: { companyId, status: 'draft' },
      }),
      this.prisma.job.count({
        where: { companyId, status: 'open' },
      }),
      this.prisma.invoice.findMany({
        where: {
          companyId,
          status: { not: 'cancelled' },
          cancelledAt: null,
          netPayable: { gt: 0 },
        },
        select: { id: true, netPayable: true, dueDate: true },
      }),
      this.prisma.invoice.count({
        where: {
          companyId,
          status: { not: 'cancelled' },
          cancelledAt: null,
          dueDate: { lt: now },
          netPayable: { gt: 0 },
        },
      }),
      this.prisma.notificationReceipt.count({
        where: { userId: session.userId, readAt: null },
      }),
      this.prisma.supportRequest.count({
        where: { companyId, status: 'open' },
      }),
      this.ledger.summaryForCompany(companyId),
    ]);

    const seatsCap = subscription?.seats ?? 0;

    return {
      subscription,
      seats: {
        active: activeUsers,
        cap: seatsCap,
        deactivated: deactivatedUsers,
      },
      openQuotations,
      openJobs,
      outstandingInvoiceCount: outstandingInvoices.length,
      arTotal: money.balanceDue,
      overdueInvoiceCount: overdueInvoices,
      unreadNotifications,
      openSupportCount: openSupport,
    };
  }

  listUsers(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        companyRole: true,
        accessExpiresAt: true,
        createdAt: true,
      },
    });
  }

  async setUserActive(
    session: CompanySessionContext,
    userId: string,
    active: boolean,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId: session.companyId },
    });
    if (!user) throw new NotFoundException('User not found');

    if (!active && user.id === session.userId && user.companyRole === 'admin') {
      const otherAdmins = await this.prisma.user.count({
        where: {
          companyId: session.companyId,
          companyRole: 'admin',
          active: true,
          NOT: { id: user.id },
        },
      });
      if (otherAdmins === 0) {
        throw new ForbiddenException(
          'Cannot deactivate yourself as the last active admin',
        );
      }
    }

    if (active && !user.active) {
      const sub = await this.prisma.companySubscription.findUnique({
        where: { companyId: session.companyId },
      });
      const seats = sub ? (sub.seatsOverride ?? sub.seatsIncluded) : 0;
      if (seats > 0) {
        const activeCount = await this.prisma.user.count({
          where: { companyId: session.companyId, active: true },
        });
        if (activeCount >= seats) {
          throw new BadRequestException('Seat limit reached');
        }
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { active },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        companyRole: true,
        accessExpiresAt: true,
      },
    });
  }

  listRenewalRequests(companyId: string) {
    return this.prisma.subscriptionRenewalRequest.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRenewalRequest(
    session: CompanySessionContext,
    input: {
      amount: number;
      paidAt: string;
      bankReference?: string;
      notes?: string;
      depositDocumentUrl: string;
    },
  ) {
    if (
      typeof input.amount !== 'number' ||
      !input.paidAt ||
      !input.depositDocumentUrl?.trim()
    ) {
      throw new BadRequestException(
        'amount, paidAt, and depositDocumentUrl are required',
      );
    }
    const pending = await this.prisma.subscriptionRenewalRequest.findFirst({
      where: { companyId: session.companyId, status: 'pending' },
    });
    if (pending) {
      throw new BadRequestException(
        'A pending renewal request already exists',
      );
    }
    return this.prisma.subscriptionRenewalRequest.create({
      data: {
        companyId: session.companyId,
        submittedByUserId: session.userId,
        amount: input.amount,
        paidAt: new Date(input.paidAt),
        bankReference: input.bankReference?.trim() || null,
        notes: input.notes?.trim() || null,
        depositDocumentUrl: input.depositDocumentUrl.trim(),
        status: 'pending',
      },
    });
  }

  async listNotifications(session: CompanySessionContext) {
    return this.prisma.notificationReceipt.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        notification: true,
      },
    });
  }

  async unreadNotificationCount(session: CompanySessionContext) {
    const count = await this.prisma.notificationReceipt.count({
      where: { userId: session.userId, readAt: null },
    });
    return { count };
  }

  async markNotificationRead(
    session: CompanySessionContext,
    notificationId: string,
  ) {
    const receipt = await this.prisma.notificationReceipt.findUnique({
      where: {
        notificationId_userId: {
          notificationId,
          userId: session.userId,
        },
      },
    });
    if (!receipt) throw new NotFoundException('Notification not found');
    return this.prisma.notificationReceipt.update({
      where: { id: receipt.id },
      data: { readAt: receipt.readAt ?? new Date() },
      include: { notification: true },
    });
  }

  async createCompanyNotification(
    session: CompanySessionContext,
    input: {
      title: string;
      body: string;
      audience: 'all_users' | 'one_user';
      userId?: string;
    },
  ) {
    if (!input.title?.trim() || !input.body?.trim()) {
      throw new BadRequestException('title and body are required');
    }
    if (input.audience !== 'all_users' && input.audience !== 'one_user') {
      throw new BadRequestException('audience must be all_users or one_user');
    }

    let userIds: string[];
    if (input.audience === 'one_user') {
      if (!input.userId) {
        throw new BadRequestException('userId is required for one_user');
      }
      const target = await this.prisma.user.findFirst({
        where: {
          id: input.userId,
          companyId: session.companyId,
          active: true,
        },
      });
      if (!target) throw new NotFoundException('Target user not found');
      userIds = [target.id];
    } else {
      const users = await this.prisma.user.findMany({
        where: { companyId: session.companyId, active: true },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }

    return this.prisma.notification.create({
      data: {
        companyId: session.companyId,
        source: 'company',
        kind: 'company_internal',
        title: input.title.trim(),
        body: input.body.trim(),
        audience: input.audience,
        userId: input.audience === 'one_user' ? input.userId : null,
        createdByUserId: session.userId,
        receipts: {
          create: userIds.map((userId) => ({ userId })),
        },
      },
      include: { receipts: true },
    });
  }

  listSupportRequests(
    session: CompanySessionContext,
    status: 'open' | 'closed' | 'all' = 'open',
  ) {
    const statusWhere =
      status === 'all' ? {} : { status: status === 'closed' ? 'closed' : 'open' };
    const ownerWhere =
      session.companyRole === 'admin'
        ? {}
        : { createdByUserId: session.userId };
    return this.prisma.supportRequest.findMany({
      where: {
        companyId: session.companyId,
        ...statusWhere,
        ...ownerWhere,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getSupportRequest(session: CompanySessionContext, id: string) {
    const row = await this.prisma.supportRequest.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        closedByUser: { select: { id: true, name: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Support request not found');
    if (
      session.companyRole !== 'admin' &&
      row.createdByUserId !== session.userId
    ) {
      throw new NotFoundException('Support request not found');
    }
    return row;
  }

  private async notifyCompanyAdmins(
    companyId: string,
    title: string,
    body: string,
    kind = 'support',
  ) {
    const admins = await this.prisma.user.findMany({
      where: { companyId, companyRole: 'admin', active: true },
      select: { id: true },
    });
    if (admins.length === 0) return;
    await this.prisma.notification.create({
      data: {
        companyId,
        source: 'system',
        kind,
        title,
        body,
        audience: 'company_admins',
        receipts: { create: admins.map((a) => ({ userId: a.id })) },
      },
    });
  }

  private async notifyUser(
    companyId: string,
    userId: string,
    title: string,
    body: string,
    kind = 'support',
  ) {
    await this.prisma.notification.create({
      data: {
        companyId,
        source: 'system',
        kind,
        title,
        body,
        audience: 'one_user',
        userId,
        receipts: { create: [{ userId }] },
      },
    });
  }

  async createSupportRequest(
    session: CompanySessionContext,
    input: { title: string; body: string; attachmentUrl?: string },
  ) {
    if (!input.title?.trim() || !input.body?.trim()) {
      throw new BadRequestException('title and body are required');
    }
    const row = await this.prisma.supportRequest.create({
      data: {
        companyId: session.companyId,
        createdByUserId: session.userId,
        title: input.title.trim(),
        body: input.body.trim(),
        attachmentUrl: input.attachmentUrl?.trim() || null,
        status: 'open',
      },
    });
    await this.notifyCompanyAdmins(
      session.companyId,
      'New support request',
      `${session.email}: ${row.title}`,
      'support',
    );
    return row;
  }

  async closeSupportRequest(
    session: CompanySessionContext,
    id: string,
    input: { note?: string } = {},
  ) {
    const row = await this.getSupportRequest(session, id);
    if (row.status === 'closed') {
      throw new BadRequestException('Already closed');
    }
    const updated = await this.prisma.supportRequest.update({
      where: { id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedByKind: 'company_admin',
        closedByUserId: session.userId,
        closeNote: input.note?.trim() || null,
      },
    });
    await this.notifyUser(
      session.companyId,
      row.createdByUserId,
      'Support request closed',
      `Your request “${row.title}” was closed.${input.note?.trim() ? ` Note: ${input.note.trim()}` : ''}`,
      'support',
    );
    return updated;
  }
}
