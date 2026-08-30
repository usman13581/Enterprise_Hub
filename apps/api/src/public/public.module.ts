import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicController } from './public.controller';
import { DemoProvisioningService } from './demo-provisioning.service';
import { PublicService } from './public.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicController],
  providers: [PublicService, DemoProvisioningService],
  exports: [DemoProvisioningService],
})
export class PublicModule {}
