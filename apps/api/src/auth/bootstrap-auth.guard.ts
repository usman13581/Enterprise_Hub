import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_HEADER, SessionContext } from './session.types';

@Injectable()
export class BootstrapAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      session?: SessionContext;
    }>();

    const token =
      req.headers[SESSION_HEADER] ||
      req.headers['authorization']?.replace(/^Bearer\s+/i, '');

    const expected = process.env.BOOTSTRAP_TOKEN ?? 'binhaj-dev-token';
    if (!token || token !== expected) {
      throw new UnauthorizedException(
        'Missing or invalid bootstrap token. Send header x-marble-token.',
      );
    }

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

    req.session = {
      companyId: company.id,
      userId: company.users[0].id,
      email: company.users[0].email,
      companyName: company.name,
    };

    return true;
  }
}
