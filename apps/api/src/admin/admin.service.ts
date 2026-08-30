import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { PlatformSessionContext } from '../auth/session.types';
import { SampleDataService } from '../sample-data/sample-data.service';

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'company';
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addInterval(from: Date, interval: string): Date {
  const next = new Date(from);
  if (interval === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function normalizeInterval(interval?: string) {
  return interval === 'year' || interval === 'yearly' ? 'yearly' : 'monthly';
}

function effectiveSeats(sub: {
  seatsIncluded: number;
  seatsOverride: number | null;
}): number {
  return sub.seatsOverride ?? sub.seatsIncluded;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly samples: SampleDataService,
  ) {}

  async notifyCompanyAdmins(
    companyId: string,
    title: string,
    body: string,
    kind = 'subscription',
  ) {
    const admins = await this.prisma.user.findMany({
      where: { companyId, companyRole: 'admin', active: true },
      select: { id: true },
    });
    if (admins.length === 0) return null;
    return this.prisma.notification.create({
      data: {
        companyId,
        source: 'system',
        kind,
        title,
        body,
        audience: 'company_admins',
        receipts: {
          create: admins.map((a) => ({ userId: a.id })),
        },
      },
    });
  }

  async overview() {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [
      pendingApps,
      appsApprovedThisMonth,
      appsRejectedThisMonth,
      subsByStatus,
      expireIn7,
      expireIn14,
      pendingRenewals,
      companyCount,
      suspendedCount,
      activeUsers,
      openSupportCount,
    ] = await Promise.all([
      this.prisma.companyApplication.count({ where: { status: 'pending' } }),
      this.prisma.companyApplication.count({
        where: { status: 'approved', decidedAt: { gte: monthStart } },
      }),
      this.prisma.companyApplication.count({
        where: { status: 'rejected', decidedAt: { gte: monthStart } },
      }),
      this.prisma.companySubscription.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.companySubscription.count({
        where: {
          expiresAt: { gte: now, lte: in7 },
          status: { in: ['trial', 'active', 'past_due'] },
        },
      }),
      this.prisma.companySubscription.count({
        where: {
          expiresAt: { gte: now, lte: in14 },
          status: { in: ['trial', 'active', 'past_due'] },
        },
      }),
      this.prisma.subscriptionRenewalRequest.count({
        where: { status: 'pending' },
      }),
      this.prisma.company.count(),
      this.prisma.company.count({ where: { suspendedAt: { not: null } } }),
      this.prisma.user.count({ where: { active: true } }),
      this.prisma.supportRequest.count({ where: { status: 'open' } }),
    ]);

    const subscriptionsByStatus: Record<string, number> = {};
    for (const row of subsByStatus) {
      subscriptionsByStatus[row.status] = row._count._all;
    }

    return {
      pendingApplications: pendingApps,
      applicationsApprovedThisMonth: appsApprovedThisMonth,
      applicationsRejectedThisMonth: appsRejectedThisMonth,
      subscriptionsByStatus,
      expiriesIn7Days: expireIn7,
      expiriesIn14Days: expireIn14,
      pendingRenewals,
      companyCount,
      suspendedCount,
      activeUsers,
      openSupport: openSupportCount,
    };
  }

  listCompanies() {
    return this.prisma.company.findMany({
      orderBy: { name: 'asc' },
      include: {
        subscription: { include: { plan: true } },
        industryCategory: true,
        _count: { select: { users: true } },
      },
    });
  }

  async createCompany(input: { name: string; slug?: string }) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('name is required');
    let slug = input.slug?.trim() ? slugify(input.slug) : slugify(name);
    const existing = await this.prisma.company.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    return this.prisma.company.create({
      data: {
        name,
        slug,
        profile: {
          create: {
            legalName: name,
            tradeName: name,
          },
        },
      },
      include: {
        profile: true,
        subscription: { include: { plan: true } },
        _count: { select: { users: true } },
      },
    });
  }

  async getCompany(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        profile: true,
        subscription: { include: { plan: true } },
        industryCategory: {
          include: {
            features: { include: { feature: true } },
          },
        },
        _count: { select: { users: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateCompany(
    id: string,
    input: { name?: string; slug?: string; industryCategoryId?: string | null },
  ) {
    await this.getCompany(id);
    if (input.slug) {
      const slug = slugify(input.slug);
      const clash = await this.prisma.company.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) throw new ConflictException('Slug already in use');
    }
    if (input.industryCategoryId) {
      const cat = await this.prisma.industryCategory.findUnique({
        where: { id: input.industryCategoryId },
      });
      if (!cat) throw new NotFoundException('Industry category not found');
    }
    return this.prisma.company.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {}),
        ...(input.industryCategoryId !== undefined
          ? { industryCategoryId: input.industryCategoryId }
          : {}),
      },
      include: {
        profile: true,
        subscription: { include: { plan: true } },
        industryCategory: true,
        _count: { select: { users: true } },
      },
    });
  }

  async suspendCompany(id: string) {
    await this.getCompany(id);
    return this.prisma.company.update({
      where: { id },
      data: { suspendedAt: new Date() },
    });
  }

  async unsuspendCompany(id: string) {
    await this.getCompany(id);
    return this.prisma.company.update({
      where: { id },
      data: { suspendedAt: null },
    });
  }

  listCompanyUsers(companyId: string) {
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
        updatedAt: true,
      },
    });
  }

  private async assertSeatAvailable(companyId: string) {
    const sub = await this.prisma.companySubscription.findUnique({
      where: { companyId },
    });
    if (!sub) return;
    const seats = effectiveSeats(sub);
    if (seats === 0) return;
    const activeCount = await this.prisma.user.count({
      where: { companyId, active: true },
    });
    if (activeCount >= seats) {
      throw new BadRequestException(
        `Seat limit reached (${activeCount}/${seats}). Increase seats or deactivate a user.`,
      );
    }
  }

  async createCompanyUser(
    companyId: string,
    input: {
      name: string;
      email: string;
      password: string;
      companyRole: 'admin' | 'member';
      accessExpiresAt?: string | null;
    },
  ) {
    await this.getCompany(companyId);
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password || !input.name?.trim()) {
      throw new BadRequestException('name, email, and password are required');
    }
    if (!['admin', 'member'].includes(input.companyRole)) {
      throw new BadRequestException('companyRole must be admin or member');
    }
    await this.assertSeatAvailable(companyId);
    const existing = await this.prisma.user.findUnique({
      where: { companyId_email: { companyId, email } },
    });
    if (existing) throw new ConflictException('Email already used in this company');
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: {
        companyId,
        name: input.name.trim(),
        email,
        passwordHash,
        companyRole: input.companyRole,
        accessExpiresAt: input.accessExpiresAt
          ? new Date(input.accessExpiresAt)
          : null,
      },
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

  async updateUser(
    id: string,
    input: {
      active?: boolean;
      companyRole?: 'admin' | 'member';
      accessExpiresAt?: string | null;
      password?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (input.active === true && !user.active) {
      await this.assertSeatAvailable(user.companyId);
    }
    if (input.companyRole && !['admin', 'member'].includes(input.companyRole)) {
      throw new BadRequestException('companyRole must be admin or member');
    }

    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 10)
      : undefined;

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.companyRole !== undefined
          ? { companyRole: input.companyRole }
          : {}),
        ...(input.accessExpiresAt !== undefined
          ? {
              accessExpiresAt: input.accessExpiresAt
                ? new Date(input.accessExpiresAt)
                : null,
            }
          : {}),
        ...(passwordHash
          ? {
              passwordHash,
              mustChangePassword: false,
              passwordChangedAt: new Date(),
            }
          : {}),
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        name: true,
        active: true,
        companyRole: true,
        accessExpiresAt: true,
        updatedAt: true,
      },
    });
  }

  listPlans() {
    return this.prisma.plan.findMany({ orderBy: { name: 'asc' } });
  }

  createPlan(input: {
    name: string;
    code: string;
    interval?: string;
    priceAed?: number;
    trialDays?: number;
    maxUsers?: number;
    active?: boolean;
  }) {
    const code = input.code.trim().toLowerCase();
    if (!input.name?.trim() || !code) {
      throw new BadRequestException('name and code are required');
    }
    return this.prisma.plan.create({
      data: {
        name: input.name.trim(),
        code,
        interval: normalizeInterval(input.interval),
        priceAed: input.priceAed ?? 0,
        trialDays: input.trialDays ?? 14,
        maxUsers: input.maxUsers ?? 0,
        active: input.active ?? true,
      },
    });
  }

  async updatePlan(
    id: string,
    input: {
      name?: string;
      code?: string;
      interval?: string;
      priceAed?: number;
      trialDays?: number;
      maxUsers?: number;
      active?: boolean;
    },
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.prisma.plan.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined
          ? { code: input.code.trim().toLowerCase() }
          : {}),
        ...(input.interval !== undefined
          ? { interval: normalizeInterval(input.interval) }
          : {}),
        ...(input.priceAed !== undefined ? { priceAed: input.priceAed } : {}),
        ...(input.trialDays !== undefined ? { trialDays: input.trialDays } : {}),
        ...(input.maxUsers !== undefined ? { maxUsers: input.maxUsers } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
  }

  async getSubscription(companyId: string) {
    await this.getCompany(companyId);
    const sub = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    return sub;
  }

  async upsertSubscription(
    companyId: string,
    input: {
      planId: string;
      status?: string;
      startsAt?: string;
      trialEndsAt?: string | null;
      expiresAt?: string | null;
      note?: string | null;
      seatsOverride?: number | null;
    },
  ) {
    await this.getCompany(companyId);
    const plan = await this.prisma.plan.findUnique({
      where: { id: input.planId },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const targetStatus = input.status ?? 'active';
    const data = {
      planId: plan.id,
      seatsIncluded: plan.maxUsers,
      status: targetStatus,
      ...(input.startsAt !== undefined
        ? { startsAt: new Date(input.startsAt) }
        : {}),
      ...(input.trialEndsAt !== undefined
        ? {
            trialEndsAt: input.trialEndsAt
              ? new Date(input.trialEndsAt)
              : null,
          }
        : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
        : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.seatsOverride !== undefined
        ? { seatsOverride: input.seatsOverride }
        : {}),
    };

    const sub = await this.prisma.$transaction(async (tx) => {
      const current = await tx.companySubscription.findUnique({
        where: { companyId },
        select: { status: true },
      });
      if (current?.status === 'trial' && targetStatus !== 'trial') {
        await this.samples.purgeTrialDataInTransaction(tx, companyId);
      }
      return tx.companySubscription.upsert({
        where: { companyId },
        create: {
          companyId,
          ...data,
          startsAt: data.startsAt ?? new Date(),
        },
        update: data,
        include: { plan: true },
      });
    });

    await this.notifyCompanyAdmins(
      companyId,
      'Subscription updated',
      `Your plan is now ${plan.name} (${sub.status}).`,
      'subscription',
    );

    return sub;
  }

  async manualPayment(
    companyId: string,
    input: {
      amount: number;
      paidAt: string;
      reference?: string;
      extendExpiresAt?: string;
    },
  ) {
    const sub = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (typeof input.amount !== 'number' || !input.paidAt) {
      throw new BadRequestException('amount and paidAt are required');
    }

    let expiresAt = sub.expiresAt;
    if (input.extendExpiresAt) {
      expiresAt = new Date(input.extendExpiresAt);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (sub.status === 'trial') {
        await this.samples.purgeTrialDataInTransaction(tx, companyId);
      }
      return tx.companySubscription.update({
        where: { companyId },
        data: {
          lastPaymentAmount: input.amount,
          lastPaymentAt: new Date(input.paidAt),
          lastPaymentRef: input.reference ?? null,
          status: 'active',
          expiresAt,
        },
        include: { plan: true },
      });
    });

    await this.notifyCompanyAdmins(
      companyId,
      'Payment recorded',
      `A payment of AED ${input.amount.toFixed(2)} was recorded. Subscription is active.`,
      'subscription',
    );

    return updated;
  }

  listRenewalRequests() {
    return this.prisma.subscriptionRenewalRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getRenewalRequest(id: string) {
    const row = await this.prisma.subscriptionRenewalRequest.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Renewal request not found');
    return row;
  }

  async approveRenewal(
    id: string,
    admin: PlatformSessionContext,
    input: { expiresAt?: string } = {},
  ) {
    const row = await this.getRenewalRequest(id);
    if (row.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }
    const sub = await this.prisma.companySubscription.findUnique({
      where: { companyId: row.companyId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');

    const base = sub.expiresAt && sub.expiresAt > new Date() ? sub.expiresAt : new Date();
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : addInterval(base, sub.plan.interval);

    await this.prisma.$transaction(async (tx) => {
      if (sub.status === 'trial') {
        await this.samples.purgeTrialDataInTransaction(tx, row.companyId, id);
      }
      await tx.subscriptionRenewalRequest.update({
        where: { id },
        data: {
          status: 'approved',
          decidedAt: new Date(),
          decidedByAdminId: admin.adminId,
        },
      });
      await tx.companySubscription.update({
        where: { companyId: row.companyId },
        data: {
          status: 'active',
          expiresAt,
          lastPaymentAmount: row.amount,
          lastPaymentAt: row.paidAt,
          lastPaymentRef: row.bankReference,
        },
      });
    });

    await this.notifyCompanyAdmins(
      row.companyId,
      'Renewal approved',
      `Your renewal request was approved. Subscription expires ${expiresAt.toISOString().slice(0, 10)}.`,
      'subscription',
    );

    return this.getRenewalRequest(id);
  }

  async rejectRenewal(
    id: string,
    admin: PlatformSessionContext,
    input: { reason: string },
  ) {
    const row = await this.getRenewalRequest(id);
    if (row.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }
    if (!input.reason?.trim()) {
      throw new BadRequestException('reason is required');
    }
    await this.prisma.subscriptionRenewalRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectReason: input.reason.trim(),
        decidedAt: new Date(),
        decidedByAdminId: admin.adminId,
      },
    });
    await this.notifyCompanyAdmins(
      row.companyId,
      'Renewal rejected',
      `Your renewal request was rejected: ${input.reason.trim()}`,
      'subscription',
    );
    return this.getRenewalRequest(id);
  }

  listApplications(status?: string) {
    return this.prisma.companyApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplication(id: string) {
    const row = await this.prisma.companyApplication.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Application not found');
    return row;
  }

  async approveApplication(
    id: string,
    admin: PlatformSessionContext,
    input: {
      planId: string;
      ownerPassword: string;
      trialDays?: number;
      slug?: string;
      industryCategoryId?: string | null;
    },
  ) {
    const app = await this.getApplication(id);
    if (app.status !== 'pending') {
      throw new BadRequestException('Application is not pending');
    }
    if (!input.ownerPassword || !input.planId) {
      throw new BadRequestException('planId and ownerPassword are required');
    }
    const plan = await this.prisma.plan.findUnique({
      where: { id: input.planId },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (input.industryCategoryId) {
      const cat = await this.prisma.industryCategory.findUnique({
        where: { id: input.industryCategoryId },
      });
      if (!cat) throw new NotFoundException('Industry category not found');
    }

    let slug = input.slug?.trim()
      ? slugify(input.slug)
      : slugify(app.tradeName || app.legalName);
    const clash = await this.prisma.company.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const trialDays = input.trialDays ?? plan.trialDays;
    const startsAt = new Date();
    const trialEndsAt = new Date(
      startsAt.getTime() + trialDays * 24 * 60 * 60 * 1000,
    );
    const passwordHash = await bcrypt.hash(input.ownerPassword, 10);
    const ownerEmail = app.email.trim().toLowerCase();

    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: app.tradeName?.trim() || app.legalName,
          slug,
          industryCategoryId: input.industryCategoryId ?? null,
          profile: {
            create: {
              legalName: app.legalName,
              tradeName: app.tradeName,
              phone: app.phone,
              email: ownerEmail,
              trn: app.trn,
              address: app.emirate,
            },
          },
          subscription: {
            create: {
              planId: plan.id,
              status: 'trial',
              startsAt,
              trialEndsAt,
              expiresAt: trialEndsAt,
              seatsIncluded: plan.maxUsers,
            },
          },
          users: {
            create: {
              email: ownerEmail,
              name: app.contactName,
              passwordHash,
              companyRole: 'admin',
              active: true,
            },
          },
        },
        include: {
          profile: true,
          subscription: { include: { plan: true } },
          users: true,
        },
      });

      await tx.companyApplication.update({
        where: { id },
        data: {
          status: 'approved',
          lifecycleStatus: 'approved',
          decidedAt: new Date(),
          decidedByAdminId: admin.adminId,
          companyId: company.id,
        },
      });

      return company;
    });

    await this.notifyCompanyAdmins(
      result.id,
      'Welcome to Prequaliq',
      `Your company application was approved. You are on the ${plan.name} trial until ${trialEndsAt.toISOString().slice(0, 10)}.`,
      'subscription',
    );

    return this.getApplication(id);
  }

  async rejectApplication(
    id: string,
    admin: PlatformSessionContext,
    input: { reason: string },
  ) {
    const app = await this.getApplication(id);
    if (app.status !== 'pending') {
      throw new BadRequestException('Application is not pending');
    }
    if (!input.reason?.trim()) {
      throw new BadRequestException('reason is required');
    }
    return this.prisma.companyApplication.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectReason: input.reason.trim(),
        decidedAt: new Date(),
        decidedByAdminId: admin.adminId,
      },
    });
  }

  async sendNotification(
    admin: PlatformSessionContext,
    input: {
      title: string;
      body: string;
      companyIds?: string[] | 'all';
      audience: 'company_admins' | 'all_users';
    },
  ) {
    if (!input.title?.trim() || !input.body?.trim()) {
      throw new BadRequestException('title and body are required');
    }
    if (
      input.audience !== 'company_admins' &&
      input.audience !== 'all_users'
    ) {
      throw new BadRequestException(
        'audience must be company_admins or all_users',
      );
    }

    let companyIds: string[];
    if (input.companyIds === 'all' || input.companyIds === undefined) {
      const all = await this.prisma.company.findMany({ select: { id: true } });
      companyIds = all.map((c) => c.id);
    } else {
      companyIds = input.companyIds;
    }
    if (companyIds.length === 0) {
      throw new BadRequestException('No companies to notify');
    }

    const created = [];
    for (const companyId of companyIds) {
      const users = await this.prisma.user.findMany({
        where: {
          companyId,
          active: true,
          ...(input.audience === 'company_admins'
            ? { companyRole: 'admin' }
            : {}),
        },
        select: { id: true },
      });
      if (users.length === 0) continue;
      const n = await this.prisma.notification.create({
        data: {
          companyId,
          source: 'platform',
          kind: 'admin_to_company',
          title: input.title.trim(),
          body: input.body.trim(),
          audience: input.audience,
          createdByPlatformAdminId: admin.adminId,
          receipts: {
            create: users.map((u) => ({ userId: u.id })),
          },
        },
      });
      created.push(n);
    }
    return { count: created.length, notifications: created };
  }

  listNotifications(limit = 50) {
    return this.prisma.notification.findMany({
      where: { source: 'platform' },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        company: { select: { id: true, name: true } },
        createdByAdmin: { select: { id: true, name: true, email: true } },
        _count: { select: { receipts: true } },
      },
    });
  }

  listSupportRequests(filters: { companyId?: string; status?: string }) {
    return this.prisma.supportRequest.findMany({
      where: {
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getSupportRequest(id: string) {
    const row = await this.prisma.supportRequest.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        closedByAdmin: { select: { id: true, name: true, email: true } },
        closedByUser: { select: { id: true, name: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Support request not found');
    return row;
  }

  async closeSupportRequest(
    id: string,
    admin: PlatformSessionContext,
    input: { note?: string } = {},
  ) {
    const row = await this.getSupportRequest(id);
    if (row.status === 'closed') {
      throw new BadRequestException('Already closed');
    }
    const updated = await this.prisma.supportRequest.update({
      where: { id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedByKind: 'platform_admin',
        closedByAdminId: admin.adminId,
        closeNote: input.note?.trim() || null,
      },
      include: {
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    await this.prisma.notification.create({
      data: {
        companyId: row.companyId,
        source: 'system',
        kind: 'support',
        title: 'Support request closed',
        body: `Your request “${row.title}” was closed by platform admin.${input.note?.trim() ? ` Note: ${input.note.trim()}` : ''}`,
        audience: 'one_user',
        userId: row.createdByUserId,
        receipts: { create: [{ userId: row.createdByUserId }] },
      },
    });
    return updated;
  }

  async listAudit(filters: { companyId?: string; limit?: number }) {
    if (!filters.companyId?.trim()) {
      throw new BadRequestException(
        'companyId is required — audit is company-wise only.',
      );
    }
    const take = Math.min(filters.limit ?? 50, 200);
    const rows = await this.prisma.auditLog.findMany({
      where: { companyId: filters.companyId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    const actorIds = [
      ...new Set(rows.map((r) => r.actorId).filter((id): id is string => !!id)),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const byId = new Map(actors.map((a) => [a.id, a]));
    return rows.map((row) => {
      const actor = row.actorId ? byId.get(row.actorId) : undefined;
      return {
        ...row,
        actorName: actor?.name ?? null,
        actorEmail: actor?.email ?? null,
      };
    });
  }

  listIndustryCategories() {
    return this.prisma.industryCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        features: {
          include: { feature: true },
        },
      },
    });
  }
}
