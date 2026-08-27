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

type CompanyJwtPayload = {
  kind?: 'company';
  sub: string;
  companyId: string;
  email: string;
  companyName: string;
  companyRole?: 'admin' | 'member';
};

type PlatformJwtPayload = {
  kind: 'platform';
  sub: string;
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

  signSession(session: SessionContext): string {
    if (isPlatformSession(session)) {
      const payload: PlatformJwtPayload = {
        kind: 'platform',
        sub: session.adminId,
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
      companyId: session.companyId,
      email: session.email,
      companyName: session.companyName,
      companyRole: session.companyRole,
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
          adminId: p.sub,
          email: p.email,
          name: p.name,
          companyId: '',
          userId: '',
          companyName: '',
          companyRole: 'member',
          features: [],
        };
      }
      const c = payload as CompanyJwtPayload;
      return {
        kind: 'company',
        userId: c.sub,
        companyId: c.companyId,
        email: c.email,
        companyName: c.companyName,
        companyRole: c.companyRole ?? 'member',
        features: [],
        adminId: '',
        name: '',
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
    }
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
      throw new ForbiddenException('Subscription inactive. Contact support.');
    }
    const sub = company.subscription;
    if (!sub) {
      throw new ForbiddenException('Subscription inactive. Contact support.');
    }
    const openStatuses = new Set(['trial', 'active', 'past_due']);
    if (!openStatuses.has(sub.status)) {
      throw new ForbiddenException('Subscription inactive. Contact support.');
    }
    if (sub.expiresAt && sub.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('Subscription inactive. Contact support.');
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
      features,
      adminId: '',
      name: '',
    };

    return {
      token: this.signSession(session),
      session,
    };
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
    return {
      token: this.signSession(session),
      session,
    };
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
      features,
      unreadNotifications: unread,
      adminId: '',
      name: '',
    };
  }
}
