import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

/**
 * Turns a Zod schema into a Nest pipe so controllers validate against the same
 * contract the clients import from `@marble/types`. Without this, malformed
 * numbers reached Prisma and surfaced as HTTP 500 instead of 400.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.') || '(root)',
            message: issue.message,
          })),
        });
      }
      throw error;
    }
  }
}

export const zodBody = <T>(schema: ZodSchema<T>) =>
  new ZodValidationPipe(schema);
