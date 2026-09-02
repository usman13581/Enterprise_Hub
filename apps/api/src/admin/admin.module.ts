import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicModule } from '../public/public.module';
import { SampleDataModule } from '../sample-data/sample-data.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CompanyDeletionService } from './company-deletion.service';

@Module({
  imports: [PrismaModule, PublicModule, SampleDataModule],
  controllers: [AdminController],
  providers: [AdminService, CompanyDeletionService],
  exports: [AdminService],
})
export class AdminModule {}
