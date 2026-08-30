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
  isCompanySession,
  isPlatformSession,
} from './session.types';

/** Authenticates either a company or platform session for shared auth routes. */
@Injectable()
export class SessionGuard implements CanActivate {
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
      throw new UnauthorizedException('Missing session. Sign in first.');
    }
    const session = this.auth.verifyToken(token);
    if (!isCompanySession(session) && !isPlatformSession(session)) {
      throw new UnauthorizedException('Valid session required.');
    }
    await this.auth.touchSession(session, true);
    req.session = session;
    return true;
  }
}
