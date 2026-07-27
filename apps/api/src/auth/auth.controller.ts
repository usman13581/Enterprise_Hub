import { Controller, Get, UseGuards } from '@nestjs/common';
import { BootstrapAuthGuard } from './bootstrap-auth.guard';
import { CurrentSession } from './current-session.decorator';
import { SessionContext } from './session.types';

@Controller('auth')
export class AuthController {
  @Get('session')
  @UseGuards(BootstrapAuthGuard)
  session(@CurrentSession() session: SessionContext) {
    return session;
  }
}
