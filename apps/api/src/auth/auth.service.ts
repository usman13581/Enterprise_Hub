import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import type { LoginInput } from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import { SessionContext } from './session.types';

type JwtPayload = {
  sub: string;
  companyId: string;
  email: string;
  companyName: string;
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
    const payload: JwtPayload = {
      sub: session.userId,
      companyId: session.companyId,
      email: session.email,
      companyName: session.companyName,
    };
    return jwt.sign(payload, this.jwtSecret(), {
      expiresIn: this.jwtExpires() as jwt.SignOptions['expiresIn'],
    });
  }

  verifyToken(token: string): SessionContext {
    try {
      const payload = jwt.verify(token, this.jwtSecret()) as JwtPayload;
      return {
        userId: payload.sub,
        companyId: payload.companyId,
        email: payload.email,
        companyName: payload.companyName,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
    }
  }

  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();
    const users = await this.prisma.user.findMany({
      where: {
        email: { equals: email },
        active: true,
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

    const session: SessionContext = {
      companyId: user.companyId,
      userId: user.id,
      email: user.email,
      companyName: user.company.name,
    };

    return {
      token: this.signSession(session),
      session,
    };
  }

  /** Bootstrap/dev fallback used by tests and local tooling. */
  async sessionFromBootstrap(): Promise<SessionContext> {
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

    return {
      companyId: company.id,
      userId: company.users[0].id,
      email: company.users[0].email,
      companyName: company.name,
    };
  }

  async refreshSession(session: SessionContext): Promise<SessionContext> {
    const user = await this.prisma.user.findFirst({
      where: { id: session.userId, companyId: session.companyId, active: true },
      include: { company: { select: { name: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Account is inactive or missing');
    }
    return {
      companyId: user.companyId,
      userId: user.id,
      email: user.email,
      companyName: user.company.name,
    };
  }
}
