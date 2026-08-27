import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  SESSION_HEADER,
  SessionContext,
  isPlatformSession,
} from './session.types';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      session?: SessionContext;
    }>();

    const token =
      req.headers[SESSION_HEADER] ||
      req.headers['authorization']?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new UnauthorizedException(
        'Missing session. Sign in as platform admin.',
      );
    }

    const session = this.auth.verifyToken(token);
    if (!isPlatformSession(session)) {
      throw new UnauthorizedException('Platform admin session required.');
    }
    req.session = session;
    return true;
  }
}
