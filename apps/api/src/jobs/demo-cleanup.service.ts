import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DemoProvisioningService } from '../public/demo-provisioning.service';

@Injectable()
export class DemoCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DemoCleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly demos: DemoProvisioningService) {}

  onModuleInit() {
    const intervalMs = Number(
      process.env.DEMO_CLEANUP_INTERVAL_MS ?? 60 * 60 * 1000,
    );
    setTimeout(() => {
      void this.run().catch((error) => this.logger.error('Demo cleanup failed', error));
      this.timer = setInterval(() => {
        void this.run().catch((error) => this.logger.error('Demo cleanup failed', error));
      }, intervalMs);
      this.timer.unref?.();
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  run() {
    return this.demos.cleanupExpired();
  }
}
