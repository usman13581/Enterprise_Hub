import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodIssue, ZodSchema } from 'zod';

/**
 * Zod 3.25 ships dual ESM/CJS builds. `@marble/types` is compiled to CJS, while
 * the Nest app (and Vitest via SWC) often import Zod as ESM. Those are separate
 * module instances, so `error instanceof ZodError` is unreliable — duck-type
 * instead and always map validation failures to HTTP 400.
 */
function isZodError(
  error: unknown,
): error is { issues: ZodIssue[]; name?: string } {
  return (
    !!error &&
    typeof error === 'object' &&
    Array.isArray((error as { issues?: unknown }).issues) &&
    ((error as { name?: string }).name === 'ZodError' ||
      (error as { constructor?: { name?: string } }).constructor?.name ===
        'ZodError')
  );
}

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (isZodError(error)) {
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
