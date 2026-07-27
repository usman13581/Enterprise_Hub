import { NestFactory } from '@nestjs/core';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { UPLOADS_DIR } from './uploads/uploads.constants';

/**
 * Reflecting any origin is fine for local development but must not ship to the
 * pilot, so the allowed origins are configurable and only fall back to
 * permissive when CORS_ORIGINS is unset.
 */
function corsOptions() {
  const configured = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!configured?.length) return { origin: true, credentials: true };
  return { origin: configured, credentials: true };
}

async function bootstrap() {
  mkdirSync(UPLOADS_DIR, { recursive: true });

  const app = await NestFactory.create(AppModule);
  app.enableCors(corsOptions());
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`Marble API listening on http://${host}:${port}`);
}

bootstrap();
