export * from './money';
export * from './documents';
export * from './allocations';
export * from './ledger';
export * from './numbering';
export * from './transitions';
export * from './sync';

import { extendFils, fromFils } from './money';

/** Kept for callers that only need a single line's margin. */
export function lineProfit(
  purchasePrice: number,
  sellPrice: number,
  qty: number,
): number {
  return fromFils(extendFils(qty, sellPrice) - extendFils(qty, purchasePrice));
}
