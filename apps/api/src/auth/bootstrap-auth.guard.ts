import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import {
  SESSION_HEADER,
  SessionContext,
  isCompanySession,
} from './session.types';
import { ALLOW_PASSWORD_SETUP } from './password-setup.decorator';

/**
 * Accepts a company JWT (from login) or the legacy bootstrap token (tests/dev).
 * Controllers keep importing this under the historical BootstrapAuthGuard name.
 * Rejects platform-admin tokens on company APIs.
 * Re-checks subscription + user access on every request.
 */
@Injectable()
export class BootstrapAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      headers: Record<string, string | undefined>;
      session?: SessionContext;
    }>();

    const token =
      req.headers[SESSION_HEADER] ||
      req.headers['authorization']?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new UnauthorizedException(
        'Missing session. Sign in, or send x-marble-token / Authorization Bearer.',
      );
    }

    const bootstrap = process.env.BOOTSTRAP_TOKEN ?? 'binhaj-dev-token';
    if (token === bootstrap && process.env.NODE_ENV !== 'production') {
      req.session = await this.auth.sessionFromBootstrap();
      return true;
    }

    const session = this.auth.verifyToken(token);
    if (!isCompanySession(session)) {
      throw new UnauthorizedException(
        'Company session required. Use company login.',
      );
    }
    const allowPasswordSetup = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_SETUP,
      [context.getHandler(), context.getClass()],
    );
    await this.auth.touchSession(session, Boolean(allowPasswordSetup));
    const access = await this.auth.assertCompanyAccess(
      session.companyId,
      session.userId,
    );
    if (session.readOnly && req.method !== 'GET' && req.method !== 'HEAD') {
      throw new ForbiddenException(
        'This company workspace is read-only for platform support.',
      );
    }
    if (access.user.mustChangePassword && !allowPasswordSetup) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password change required.',
      });
    }
    const features = await this.auth.featuresForCompany(session.companyId);
    req.session = {
      ...session,
      features,
      mustChangePassword: access.user.mustChangePassword,
    };
    return true;
  }
}
