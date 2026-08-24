import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BootstrapAuthGuard } from './bootstrap-auth.guard';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, BootstrapAuthGuard],
  exports: [AuthService, BootstrapAuthGuard],
})
export class AuthModule {}
