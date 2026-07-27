import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { BootstrapAuthGuard } from './bootstrap-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [BootstrapAuthGuard],
  exports: [BootstrapAuthGuard],
})
export class AuthModule {}
