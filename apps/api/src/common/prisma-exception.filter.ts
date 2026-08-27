import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Maps Prisma's own errors onto sensible HTTP statuses. Previously any bad
 * value that slipped past a controller produced a bare 500, which told the
 * client nothing and looked like a server fault rather than bad input.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = this.toHttpException(error);

    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      this.logger.warn(
        `Prisma rejected a request: ${(error as Error).message.split('\n')[0]}`,
      );
    }

    response.status(mapped.getStatus()).json(mapped.getResponse());
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new ConflictException('A record with that value already exists');
      }
      if (error.code === 'P2003' || error.code === 'P2025') {
        return new BadRequestException('Referenced record does not exist');
      }
      // Surface code so ops can spot missing migrations (P2021/P2022) quickly.
      return new BadRequestException({
        message: 'Request contained invalid values',
        prismaCode: error.code,
        prismaMeta: error.meta ?? null,
      });
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      return new BadRequestException({
        message: 'Request contained invalid values',
        prismaCode: 'VALIDATION',
        detail: error.message.split('\n')[0],
      });
    }
    return new BadRequestException('Request contained invalid values');
  }
}
