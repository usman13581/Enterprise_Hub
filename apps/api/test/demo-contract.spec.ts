import { describe, expect, it } from 'vitest';
import { demoRequestSchema } from '@marble/types';

describe('demo request contract', () => {
  it('requires only the company name and email', () => {
    const result = demoRequestSchema.parse({
      companyName: '  Example Marble  ',
      email: '  OWNER@EXAMPLE.COM ',
    });

    expect(result.companyName).toBe('Example Marble');
    expect(result.email).toBe('owner@example.com');
    expect(result.contactName).toBeNull();
    expect(result.honeypot).toBeNull();
  });

  it('rejects malformed public input', () => {
    const result = demoRequestSchema.safeParse({
      companyName: '',
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
  });
});
