import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { BootstrapAuthGuard } from './bootstrap-auth.guard';
import { isCompanySession } from './session.types';

/** Company JWT + companyRole=admin. */
@Injectable()
export class CompanyAdminGuard implements CanActivate {
  constructor(private readonly companyGuard: BootstrapAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = await this.companyGuard.canActivate(context);
    if (!ok) return false;
    const req = context.switchToHttp().getRequest<{ session?: unknown }>();
    const session = req.session;
    if (!session || !isCompanySession(session as never) || (session as { companyRole?: string }).companyRole !== 'admin') {
      throw new ForbiddenException('Company admin access required.');
    }
    return true;
  }
}
