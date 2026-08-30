import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthController, AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BootstrapAuthGuard } from './bootstrap-auth.guard';
import { CompanyAdminGuard } from './company-admin.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { SessionGuard } from './session.guard';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController, AdminAuthController],
  providers: [
    AuthService,
    BootstrapAuthGuard,
    CompanyAdminGuard,
    PlatformAdminGuard,
    SessionGuard,
  ],
  exports: [
    AuthService,
    BootstrapAuthGuard,
    CompanyAdminGuard,
    PlatformAdminGuard,
    SessionGuard,
  ],
})
export class AuthModule {}