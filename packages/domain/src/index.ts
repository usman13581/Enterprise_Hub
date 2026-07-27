/** UAE VAT rate for tax invoices (v1). */
export const UAE_VAT_RATE = 0.05;

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calcVat(taxableAmount: number, rate = UAE_VAT_RATE) {
  const taxable = roundMoney(taxableAmount);
  const vat = roundMoney(taxable * rate);
  return {
    taxable,
    vat,
    total: roundMoney(taxable + vat),
  };
}

export function lineProfit(purchasePrice: number, sellPrice: number, qty: number) {
  return roundMoney((sellPrice - purchasePrice) * qty);
}
