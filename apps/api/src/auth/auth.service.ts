import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import type { LoginInput } from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CompanySessionContext,
  PlatformSessionContext,
  SessionContext,
  isCompanySession,
  isPlatformSession,
} from './session.types';
import { createHash, randomUUID } from 'crypto';

type CompanyJwtPayload = {
  kind?: 'company';
  sub: string;
  sid?: string;
  companyId: string;
  email: string;
  companyName: string;
  companyRole?: 'admin' | 'member';
  mustChangePassword?: boolean;
};

type PlatformJwtPayload = {
  kind: 'platform';
  sub: string;
  sid?: string;
  email: string;
  name: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private jwtSecret() {
    return process.env.JWT_SECRET || process.env.BOOTSTRAP_TOKEN || 'marble-dev-secret';
  }

  private jwtExpires() {
    return process.env.JWT_EXPIRES_IN || '7d';
  }

  private idleMs() {
    return Number(process.env.SESSION_IDLE_MINUTES ?? 30) * 60 * 1000;
  }

  private absoluteMs() {
    return Number(process.env.SESSION_ABSOLUTE_DAYS ?? 7) * 24 * 60 * 60 * 1000;
  }

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  signSession(session: SessionContext, sessionId?: string): string {
    if (isPlatformSession(session)) {
      const payload: PlatformJwtPayload = {
        kind: 'platform',
        sub: session.adminId,
        sid: sessionId,
        email: session.email,
        name: session.name,
      };
      return jwt.sign(payload, this.jwtSecret(), {
        expiresIn: this.jwtExpires() as jwt.SignOptions['expiresIn'],
      });
    }
    const payload: CompanyJwtPayload = {
      kind: 'company',
      sub: session.userId,
      sid: sessionId,
      companyId: session.companyId,
      email: session.email,
      companyName: session.companyName,
      companyRole: session.companyRole,
      mustChangePassword: session.mustChangePassword,
    };
    return jwt.sign(payload, this.jwtSecret(), {
      expiresIn: this.jwtExpires() as jwt.SignOptions['expiresIn'],
    });
  }

  verifyToken(token: string): SessionContext {
    try {
      const payload = jwt.verify(token, this.jwtSecret()) as
        | CompanyJwtPayload
        | PlatformJwtPayload;
      if ((payload as PlatformJwtPayload).kind === 'platform') {
        const p = payload as PlatformJwtPayload;
        return {
          kind: 'platform',
          sessionId: p.sid,
          adminId: p.sub,
          email: p.email,
          name: p.name,
          companyId: '',
          userId: '',
          companyName: '',
          companyRole: 'member',
          features: [],
          mustChangePassword: false,
        };
      }
      const c = payload as CompanyJwtPayload;
      return {
        kind: 'company',
        sessionId: c.sid,
        userId: c.sub,
        companyId: c.companyId,
        email: c.email,
        companyName: c.companyName,
        companyRole: c.companyRole ?? 'member',
        features: [],
        mustChangePassword: Boolean(c.mustChangePassword),
        adminId: '',
        name: '',
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
    }
  }

  private async createPersistedSession(
    session: SessionContext,
    token: string,
    sessionId: string,
    now = new Date(),
  ) {
    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        kind: session.kind,
        tokenHash: this.tokenHash(token),
        userId: isCompanySession(session) ? session.userId : null,
        platformAdminId: isPlatformSession(session) ? session.adminId : null,
        createdAt: now,
        lastActivityAt: now,
        absoluteExpiresAt: new Date(now.getTime() + this.absoluteMs()),
      },
    });
  }

  async issueSession(session: SessionContext) {
    const sessionId = randomUUID();
    const token = this.signSession(session, sessionId);
    await this.createPersistedSession(session, token, sessionId);
    return { token, session };
  }

  async touchSession(session: SessionContext, allowPasswordSetup = false) {
    if (!session.sessionId) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Session expired. Please sign in again.',
      });
    }
    const stored = await this.prisma.authSession.findUnique({
      where: { id: session.sessionId },
    });
    const now = new Date();
    if (
      !stored ||
      stored.kind !== session.kind ||
      stored.revokedAt ||
      stored.absoluteExpiresAt.getTime() <= now.getTime() ||
      stored.lastActivityAt.getTime() + this.idleMs() <= now.getTime()
    ) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Session expired. Please sign in again.',
      });
    }
    if (isCompanySession(session)) {
      const access = await this.assertCompanyAccess(
        session.companyId,
        session.userId,
      );
      if (access.user.mustChangePassword && !allowPasswordSetup) {
        throw new ForbiddenException({
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Change your temporary password before continuing.',
        });
      }
    } else {
      const admin = await this.prisma.platformAdmin.findFirst({
        where: { id: session.adminId, active: true },
      });
      if (!admin) throw new UnauthorizedException('Account is inactive or missing');
    }
    if (now.getTime() - stored.lastActivityAt.getTime() >= 60_000) {
      await this.prisma.authSession.update({
        where: { id: stored.id },
        data: { lastActivityAt: now },
      });
    }
    return stored;
  }

  async revokeSession(session: SessionContext) {
    if (!session.sessionId) return;
    await this.prisma.authSession.updateMany({
      where: { id: session.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(session: SessionContext, password: string) {
    if (!isCompanySession(session)) {
      throw new BadRequestException('Password setup is only available for company users.');
    }
    if (password.length < 12 || password.length > 200) {
      throw new BadRequestException('Password must be between 12 and 200 characters.');
    }
    const access = await this.assertCompanyAccess(session.companyId, session.userId);
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: session.userId },
        data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    const refreshed: CompanySessionContext = {
      ...session,
      companyName: access.company.name,
      mustChangePassword: false,
    };
    return this.issueSession(refreshed);
  }

  /** Features for a company from its industry category links. */
  async featuresForCompany(companyId: string): Promise<string[]> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        industryCategory: {
          select: {
            features: {
              where: { feature: { active: true } },
              select: { feature: { select: { key: true } } },
            },
          },
        },
      },
    });
    if (!company?.industryCategory) return [];
    return company.industryCategory.features.map((f) => f.feature.key);
  }

  async assertCompanyAccess(companyId: string, userId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { subscription: true },
    });
    if (!company) {
      throw new UnauthorizedException('Company not found');
    }
    if (company.suspendedAt) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_INACTIVE',
        message: 'Subscription inactive. Contact support.',
      });
    }
    const sub = company.subscription;
    if (!sub) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_INACTIVE',
        message: 'Subscription inactive. Contact support.',
      });
    }
    const openStatuses = new Set(['trial', 'active', 'past_due']);
    if (!openStatuses.has(sub.status)) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_INACTIVE',
        message: 'Subscription inactive. Contact support.',
      });
    }
    if (sub.expiresAt && sub.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_INACTIVE',
        message: 'Trial or subscription has expired. Contact support to renew.',
      });
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
    });
    if (!user) {
      throw new UnauthorizedException('Account is inactive or missing');
    }
    if (!user.active) {
      throw new ForbiddenException(
        'This login is disabled. Contact your company admin.',
      );
    }
    if (user.accessExpiresAt && user.accessExpiresAt.getTime() < Date.now()) {
      throw new ForbiddenException(
        'This login has expired. Contact your company admin.',
      );
    }
    return { company, user, subscription: sub };
  }

  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();
    const users = await this.prisma.user.findMany({
      where: {
        email: { equals: email },
        ...(input.companySlug
          ? { company: { slug: input.companySlug } }
          : {}),
      },
      include: { company: { select: { id: true, name: true, slug: true } } },
      take: 5,
    });

    if (users.length === 0) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (users.length > 1 && !input.companySlug) {
      throw new BadRequestException(
        'This email belongs to more than one company. Include companySlug.',
      );
    }

    const user = users[0];
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account has no password set. Re-run the database seed.',
      );
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.assertCompanyAccess(user.companyId, user.id);

    const features = await this.featuresForCompany(user.companyId);
    const session: CompanySessionContext = {
      kind: 'company',
      companyId: user.companyId,
      userId: user.id,
      email: user.email,
      companyName: user.company.name,
      companyRole: (user.companyRole as 'admin' | 'member') || 'member',
      mustChangePassword: user.mustChangePassword,
      features,
      adminId: '',
      name: '',
    };

    return this.issueSession(session);
  }

  async adminLogin(input: { email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email } });
    if (!admin || !admin.active) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(input.password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const session: PlatformSessionContext = {
      kind: 'platform',
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      companyId: '',
      userId: '',
      companyName: '',
      companyRole: 'member',
      features: [],
    };
    return this.issueSession(session);
  }

  /** Bootstrap/dev fallback used by tests and local tooling. */
  async sessionFromBootstrap(): Promise<CompanySessionContext> {
    const slug = process.env.BOOTSTRAP_COMPANY_SLUG ?? 'binhaj-marble';
    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: {
        users: {
          where: { active: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!company || company.users.length === 0) {
      throw new UnauthorizedException(
        'Bootstrap company not seeded. Run pnpm db:seed.',
      );
    }

    const user = company.users[0];
    await this.assertCompanyAccess(company.id, user.id);
    const features = await this.featuresForCompany(company.id);

    return {
      kind: 'company',
      companyId: company.id,
      userId: user.id,
      email: user.email,
      companyName: company.name,
      companyRole: (user.companyRole as 'admin' | 'member') || 'admin',
      features,
      adminId: '',
      name: '',
    };
  }

  async refreshSession(session: SessionContext): Promise<SessionContext> {
    if (isPlatformSession(session)) {
      const admin = await this.prisma.platformAdmin.findFirst({
        where: { id: session.adminId, active: true },
      });
      if (!admin) {
        throw new UnauthorizedException('Account is inactive or missing');
      }
      return {
        kind: 'platform',
        adminId: admin.id,
        email: admin.email,
        name: admin.name,
        companyId: '',
        userId: '',
        companyName: '',
        companyRole: 'member',
        features: [],
      };
    }
    if (!isCompanySession(session)) {
      throw new UnauthorizedException('Invalid session');
    }
    await this.assertCompanyAccess(session.companyId, session.userId);
    const user = await this.prisma.user.findFirst({
      where: { id: session.userId, companyId: session.companyId },
      include: { company: { select: { name: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Account is inactive or missing');
    }
    const features = await this.featuresForCompany(session.companyId);
    const unread = await this.prisma.notificationReceipt.count({
      where: { userId: user.id, readAt: null },
    });
    return {
      kind: 'company',
      companyId: user.companyId,
      userId: user.id,
      email: user.email,
      companyName: user.company.name,
      companyRole: (user.companyRole as 'admin' | 'member') || 'member',
      mustChangePassword: user.mustChangePassword,
      features,
      unreadNotifications: unread,
      adminId: '',
      name: '',
    };
  }
}
