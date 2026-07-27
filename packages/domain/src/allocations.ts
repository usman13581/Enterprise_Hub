import { fromFils, sumFils, toFils } from './money';

export type AdvanceLike = {
  id: string;
  amount: number;
  allocatedAmount: number;
  customerId: string;
  jobId?: string | null;
};

export type AllocationRequest = {
  advanceId: string;
  amount: number;
};

export type AllocationCheck =
  | { ok: true; totalApplied: number }
  | { ok: false; error: string };

export function unallocatedAmount(advance: AdvanceLike): number {
  return fromFils(
    Math.max(0, toFils(advance.amount) - toFils(advance.allocatedAmount)),
  );
}

/**
 * Validates a set of advance allocations against both the advances themselves
 * and the invoice they are being applied to. Allocation is bookkeeping only:
 * the cash arrived when the advance was recorded, so allocating it must never
 * be allowed to exceed what was actually received.
 */
export function checkAllocations(
  requests: AllocationRequest[],
  advances: AdvanceLike[],
  context: { customerId: string; jobId?: string | null; invoiceTotal: number },
): AllocationCheck {
  if (requests.length === 0) return { ok: true, totalApplied: 0 };

  const byId = new Map(advances.map((advance) => [advance.id, advance]));
  const requestedByAdvance = new Map<string, number>();

  for (const request of requests) {
    const advance = byId.get(request.advanceId);
    if (!advance) {
      return { ok: false, error: `Advance ${request.advanceId} not found` };
    }
    if (advance.customerId !== context.customerId) {
      return {
        ok: false,
        error: 'Advance belongs to a different customer',
      };
    }
    if (
      advance.jobId &&
      context.jobId &&
      advance.jobId !== context.jobId
    ) {
      return {
        ok: false,
        error: 'Advance was taken against a different job',
      };
    }
    if (toFils(request.amount) <= 0) {
      return { ok: false, error: 'Allocation amount must be greater than zero' };
    }
    requestedByAdvance.set(
      request.advanceId,
      (requestedByAdvance.get(request.advanceId) ?? 0) + toFils(request.amount),
    );
  }

  for (const [advanceId, requestedFils] of requestedByAdvance) {
    const advance = byId.get(advanceId)!;
    const availableFils = toFils(unallocatedAmount(advance));
    if (requestedFils > availableFils) {
      return {
        ok: false,
        error: `Advance has only ${fromFils(availableFils).toFixed(2)} unallocated`,
      };
    }
  }

  const totalFils = sumFils(requests.map((r) => toFils(r.amount)));
  if (totalFils > toFils(context.invoiceTotal)) {
    return {
      ok: false,
      error: 'Allocated advances exceed the invoice total',
    };
  }

  return { ok: true, totalApplied: fromFils(totalFils) };
}

/**
 * Consumes the oldest advances first, which is what operators expect when they
 * ask the system to "apply available advances" to a new invoice.
 */
export function autoAllocate(
  advances: AdvanceLike[],
  invoiceTotal: number,
): AllocationRequest[] {
  let remainingFils = toFils(invoiceTotal);
  const result: AllocationRequest[] = [];

  for (const advance of advances) {
    if (remainingFils <= 0) break;
    const availableFils = toFils(unallocatedAmount(advance));
    if (availableFils <= 0) continue;
    const takeFils = Math.min(availableFils, remainingFils);
    result.push({ advanceId: advance.id, amount: fromFils(takeFils) });
    remainingFils -= takeFils;
  }

  return result;
}
