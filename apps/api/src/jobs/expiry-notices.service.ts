import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SUB_NOTICE_DAYS = [14, 7, 3, 1] as const;
const USER_NOTICE_DAYS = [7, 3, 1] as const;

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function sameUtcDay(a: Date | null | undefined, b: Date): boolean {
  if (!a) return false;
  return startOfUtcDay(a).getTime() === startOfUtcDay(b).getTime();
}

/** Whole UTC days from today (start) until the expiry date (start). */
function daysUntil(expiry: Date, now: Date): number {
  const from = startOfUtcDay(now).getTime();
  const to = startOfUtcDay(expiry).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

@Injectable()
export class ExpiryNoticesService implements OnModuleInit {
  private readonly logger = new Logger(ExpiryNoticesService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const intervalMs = Number(
      process.env.EXPIRE_NOTICE_INTERVAL_MS ?? 24 * 60 * 60 * 1000,
    );
    setTimeout(() => {
      void this.run().catch((err) =>
        this.logger.error('Initial expiry notice run failed', err),
      );
      this.timer = setInterval(() => {
        void this.run().catch((err) =>
          this.logger.error('Expiry notice run failed', err),
        );
      }, intervalMs);
      if (typeof this.timer.unref === 'function') {
        this.timer.unref();
      }
    }, 30_000);
  }

  async run() {
    const now = new Date();
    await this.notifySubscriptions(now);
    await this.notifyUsers(now);
  }

  private async notifyCompanyAdmins(
    companyId: string,
    title: string,
    body: string,
    kind: string,
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

  private async notifySubscriptions(now: Date) {
    const subs = await this.prisma.companySubscription.findMany({
      where: {
        status: { in: ['trial', 'active', 'past_due'] },
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    for (const sub of subs) {
      if (sameUtcDay(sub.lastExpiryNoticeAt, now)) continue;

      const candidates: Array<{ at: Date; label: string }> = [];
      if (sub.expiresAt) {
        candidates.push({ at: sub.expiresAt, label: 'subscription' });
      }
      if (sub.trialEndsAt && sub.status === 'trial') {
        candidates.push({ at: sub.trialEndsAt, label: 'trial' });
      }

      let matchedDays: number | null = null;
      let matchedLabel = 'subscription';
      for (const c of candidates) {
        const days = daysUntil(c.at, now);
        if (!(SUB_NOTICE_DAYS as readonly number[]).includes(days)) continue;
        if (matchedDays == null || days < matchedDays) {
          matchedDays = days;
          matchedLabel = c.label;
        }
      }
      if (matchedDays == null) continue;

      const title = `Subscription expires in ${matchedDays} day${matchedDays === 1 ? '' : 's'}`;
      const body = `${sub.company.name}'s ${matchedLabel} ends in ${matchedDays} day${matchedDays === 1 ? '' : 's'}. Renew to avoid interruption.`;

      await this.notifyCompanyAdmins(
        sub.companyId,
        title,
        body,
        'expiry_subscription',
      );
      await this.prisma.companySubscription.update({
        where: { id: sub.id },
        data: { lastExpiryNoticeAt: now },
      });
    }
  }

  private async notifyUsers(now: Date) {
    const users = await this.prisma.user.findMany({
      where: {
        active: true,
        accessExpiresAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        companyId: true,
        accessExpiresAt: true,
      },
    });

    const dayStart = startOfUtcDay(now);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    for (const user of users) {
      if (!user.accessExpiresAt) continue;
      const days = daysUntil(user.accessExpiresAt, now);
      if (!(USER_NOTICE_DAYS as readonly number[]).includes(days)) continue;

      const title = `Access expires in ${days} day${days === 1 ? '' : 's'}`;
      const body = `${user.name} (${user.email}) access ends in ${days} day${days === 1 ? '' : 's'}.`;

      const already = await this.prisma.notification.findFirst({
        where: {
          kind: 'expiry_user',
          title,
          createdAt: { gte: dayStart, lt: dayEnd },
          OR: [
            { userId: user.id },
            {
              companyId: user.companyId,
              receipts: { some: { userId: user.id } },
            },
          ],
        },
      });
      if (already) continue;

      const admins = await this.prisma.user.findMany({
        where: {
          companyId: user.companyId,
          companyRole: 'admin',
          active: true,
        },
        select: { id: true },
      });
      const recipientIds = new Set<string>([user.id, ...admins.map((a) => a.id)]);

      await this.prisma.notification.create({
        data: {
          companyId: user.companyId,
          source: 'system',
          kind: 'expiry_user',
          title,
          body,
          audience: 'one_user',
          userId: user.id,
          receipts: {
            create: [...recipientIds].map((userId) => ({ userId })),
          },
        },
      });
    }
  }
}
