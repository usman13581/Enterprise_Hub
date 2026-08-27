import { Controller, Get } from '@nestjs/common';
import { APP_VERSION } from '@marble/types';

@Controller('health')
export class HealthController {
  @Get()
  ok() {
    return {
      ok: true,
      service: 'marble-api',
      version: APP_VERSION,
      phase: 5,
    };
  }
}
