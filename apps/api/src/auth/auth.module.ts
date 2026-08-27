import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthController, AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BootstrapAuthGuard } from './bootstrap-auth.guard';
import { CompanyAdminGuard } from './company-admin.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController, AdminAuthController],
  providers: [
    AuthService,
    BootstrapAuthGuard,
    CompanyAdminGuard,
    PlatformAdminGuard,
  ],
  exports: [
    AuthService,
    BootstrapAuthGuard,
    CompanyAdminGuard,
    PlatformAdminGuard,
  ],
})
export class AuthModule {}