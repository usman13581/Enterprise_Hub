import { fromFils, toFils } from './money';

export type DiscountMode = 'none' | 'fixed' | 'percent';

export type DiscountFields = {
  discountMode?: DiscountMode;
  discountValue?: number;
};

/** Normalize legacy fixed `discount` payloads into mode + value. */
export function normalizeDiscount(
  fields: DiscountFields & { discount?: number },
): { discountMode: DiscountMode; discountValue: number } {
  const mode = fields.discountMode ?? 'none';
  const value = fields.discountValue ?? 0;
  if (mode !== 'none' || value > 0) {
    return { discountMode: mode, discountValue: value };
  }
  if ((fields.discount ?? 0) > 0) {
    return { discountMode: 'fixed', discountValue: fields.discount! };
  }
  return { discountMode: 'none', discountValue: 0 };
}

/** Apply a discount to a gross amount (fils). Returns net and discount applied. */
export function applyDiscountFils(
  grossFils: number,
  mode: DiscountMode = 'none',
  value = 0,
): { netFils: number; discountFils: number } {
  const gross = Math.max(0, grossFils);
  if (mode === 'none' || value <= 0) {
    return { netFils: gross, discountFils: 0 };
  }
  let discountFils = 0;
  if (mode === 'fixed') {
    discountFils = Math.min(Math.max(0, toFils(value)), gross);
  } else {
    const pct = Math.min(100, Math.max(0, value));
    discountFils = Math.round(gross * (pct / 100));
  }
  return { netFils: gross - discountFils, discountFils };
}

export function applyDiscount(
  gross: number,
  mode: DiscountMode = 'none',
  value = 0,
): { net: number; discountAmount: number } {
  const { netFils, discountFils } = applyDiscountFils(
    toFils(gross),
    mode,
    value,
  );
  return { net: fromFils(netFils), discountAmount: fromFils(discountFils) };
}
