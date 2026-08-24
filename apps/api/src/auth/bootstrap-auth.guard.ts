import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SESSION_HEADER, SessionContext } from './session.types';

/**
 * Accepts a user JWT (from login) or the legacy bootstrap token (tests/dev).
 * Controllers keep importing this under the historical BootstrapAuthGuard name.
 */
@Injectable()
export class BootstrapAuthGuard implements CanActivate {
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
        'Missing session. Sign in, or send x-marble-token / Authorization Bearer.',
      );
    }

    const bootstrap = process.env.BOOTSTRAP_TOKEN ?? 'binhaj-dev-token';
    if (token === bootstrap) {
      req.session = await this.auth.sessionFromBootstrap();
      return true;
    }

    // Prefer verifying JWT without a DB hit; refresh name/active on session endpoint.
    req.session = this.auth.verifyToken(token);
    return true;
  }
}
