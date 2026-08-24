import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { loginSchema, type LoginInput } from '@marble/types';
import { zodBody } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { BootstrapAuthGuard } from './bootstrap-auth.guard';
import { CurrentSession } from './current-session.decorator';
import { SessionContext } from './session.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body(zodBody(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Get('session')
  @UseGuards(BootstrapAuthGuard)
  async session(@CurrentSession() session: SessionContext) {
    return this.auth.refreshSession(session);
  }

  /** Client clears the token; endpoint exists for symmetry and future revoke lists. */
  @Post('logout')
  @UseGuards(BootstrapAuthGuard)
  logout() {
    return { ok: true };
  }
}
