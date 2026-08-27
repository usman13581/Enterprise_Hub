import { Controller, Get } from '@nestjs/common';
import { APP_VERSION } from '@marble/types';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  ok() {
    return {
      ok: true,
      service: 'marble-api',
      version: APP_VERSION,
      phase: 5,
      // bump: force Railway rebuild so boot runs db push + seed
      boot: 'schema-seed-v1',
    };
  }

  /** Lightweight schema readiness probe for deploys. */
  @Get('db')
  async db() {
    try {
      const [users, platformAdmins, applications] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.platformAdmin.count(),
        this.prisma.companyApplication.count(),
      ]);
      return {
        ok: true,
        users,
        platformAdmins,
        applications,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message.split('\n')[0]
            : 'database probe failed',
      };
    }
  }
}
