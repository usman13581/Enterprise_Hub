import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SampleDataController } from './sample-data.controller';
import { SampleDataService } from './sample-data.service';

@Module({
  imports: [PrismaModule],
  controllers: [SampleDataController],
  providers: [SampleDataService],
  exports: [SampleDataService],
})
export class SampleDataModule {}
