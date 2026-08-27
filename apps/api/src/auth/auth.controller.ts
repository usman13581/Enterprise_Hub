import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { loginSchema, type LoginInput } from '@marble/types';
import { z } from 'zod';
import { zodBody } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { BootstrapAuthGuard } from './bootstrap-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { CurrentSession } from './current-session.decorator';
import { SessionContext, isCompanySession } from './session.types';

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body(zodBody(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Post('admin/login')
  async adminLogin(
    @Body(zodBody(adminLoginSchema)) body: z.infer<typeof adminLoginSchema>,
  ) {
    return this.auth.adminLogin(body);
  }

  @Get('session')
  @UseGuards(BootstrapAuthGuard)
  async session(@CurrentSession() session: SessionContext) {
    if (!isCompanySession(session)) {
      return session;
    }
    return this.auth.refreshSession(session);
  }

  /** Client clears the token; endpoint exists for symmetry and future revoke lists. */
  @Post('logout')
  @UseGuards(BootstrapAuthGuard)
  logout() {
    return { ok: true };
  }
}

@Controller('admin')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('session')
  @UseGuards(PlatformAdminGuard)
  async session(@CurrentSession() session: SessionContext) {
    return this.auth.refreshSession(session);
  }
}
