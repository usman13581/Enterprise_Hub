import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  ok() {
    return {
      ok: true,
      service: 'marble-api',
      phase: 5,
      deploy: 'docker-v5',
    };
  }
}
