import { describe, expect, it } from 'vitest';
import {
  autoAllocate,
  checkAllocations,
  unallocatedAmount,
  type AdvanceLike,
} from './allocations';

const advance = (over: Partial<AdvanceLike> = {}): AdvanceLike => ({
  id: 'adv-1',
  amount: 1000,
  allocatedAmount: 0,
  customerId: 'cust-1',
  jobId: 'job-1',
  ...over,
});

describe('unallocatedAmount', () => {
  it('reports what is left on an advance', () => {
    expect(unallocatedAmount(advance({ allocatedAmount: 400 }))).toBe(600);
  });

  it('never reports a negative remainder', () => {
    expect(unallocatedAmount(advance({ allocatedAmount: 1500 }))).toBe(0);
  });
});

describe('checkAllocations', () => {
  const context = { customerId: 'cust-1', jobId: 'job-1', invoiceTotal: 1050 };

  it('accepts an allocation within the available balance', () => {
    const result = checkAllocations(
      [{ advanceId: 'adv-1', amount: 500 }],
      [advance()],
      context,
    );
    expect(result).toEqual({ ok: true, totalApplied: 500 });
  });

  it('treats an empty request as a no-op', () => {
    expect(checkAllocations([], [advance()], context)).toEqual({
      ok: true,
      totalApplied: 0,
    });
  });

  it('rejects allocating more than the advance holds', () => {
    const result = checkAllocations(
      [{ advanceId: 'adv-1', amount: 1200 }],
      [advance()],
      context,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects double-spending the same advance across two lines', () => {
    const result = checkAllocations(
      [
        { advanceId: 'adv-1', amount: 600 },
        { advanceId: 'adv-1', amount: 600 },
      ],
      [advance()],
      context,
    );
    expect(result.ok).toBe(false);
  });

  it('accounts for what was already allocated elsewhere', () => {
    const result = checkAllocations(
      [{ advanceId: 'adv-1', amount: 500 }],
      [advance({ allocatedAmount: 700 })],
      context,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an advance belonging to another customer', () => {
    const result = checkAllocations(
      [{ advanceId: 'adv-1', amount: 100 }],
      [advance({ customerId: 'cust-2' })],
      context,
    );
    expect(result).toEqual({
      ok: false,
      error: 'Advance belongs to a different customer',
    });
  });

  it('rejects an advance taken against another job', () => {
    const result = checkAllocations(
      [{ advanceId: 'adv-1', amount: 100 }],
      [advance({ jobId: 'job-9' })],
      context,
    );
    expect(result).toEqual({
      ok: false,
      error: 'Advance was taken against a different job',
    });
  });

  it('allows a customer-level advance with no job against any job', () => {
    const result = checkAllocations(
      [{ advanceId: 'adv-1', amount: 100 }],
      [advance({ jobId: null })],
      context,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown advance', () => {
    const result = checkAllocations(
      [{ advanceId: 'missing', amount: 100 }],
      [advance()],
      context,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects allocations exceeding the invoice total', () => {
    const result = checkAllocations(
      [{ advanceId: 'adv-1', amount: 900 }],
      [advance()],
      { ...context, invoiceTotal: 500 },
    );
    expect(result).toEqual({
      ok: false,
      error: 'Allocated advances exceed the invoice total',
    });
  });

  it('rejects a zero or negative allocation', () => {
    expect(
      checkAllocations([{ advanceId: 'adv-1', amount: 0 }], [advance()], context)
        .ok,
    ).toBe(false);
  });
});

describe('autoAllocate', () => {
  it('consumes the oldest advances first', () => {
    const result = autoAllocate(
      [
        advance({ id: 'a', amount: 300 }),
        advance({ id: 'b', amount: 500 }),
        advance({ id: 'c', amount: 900 }),
      ],
      1000,
    );
    expect(result).toEqual([
      { advanceId: 'a', amount: 300 },
      { advanceId: 'b', amount: 500 },
      { advanceId: 'c', amount: 200 },
    ]);
  });

  it('skips advances with nothing left', () => {
    const result = autoAllocate(
      [
        advance({ id: 'a', amount: 300, allocatedAmount: 300 }),
        advance({ id: 'b', amount: 200 }),
      ],
      1000,
    );
    expect(result).toEqual([{ advanceId: 'b', amount: 200 }]);
  });

  it('stops once the invoice is covered', () => {
    const result = autoAllocate([advance({ id: 'a', amount: 5000 })], 120.5);
    expect(result).toEqual([{ advanceId: 'a', amount: 120.5 }]);
  });

  it('produces allocations that pass validation', () => {
    const advances = [advance({ id: 'a', amount: 400 }), advance({ id: 'b', amount: 400 })];
    const requests = autoAllocate(advances, 700);
    expect(
      checkAllocations(requests, advances, {
        customerId: 'cust-1',
        jobId: 'job-1',
        invoiceTotal: 700,
      }).ok,
    ).toBe(true);
  });
});
