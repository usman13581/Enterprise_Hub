import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NumberingService } from './numbering.service';

@Module({
  imports: [PrismaModule],
  providers: [NumberingService],
  exports: [NumberingService],
})
export class CommonModule {}
