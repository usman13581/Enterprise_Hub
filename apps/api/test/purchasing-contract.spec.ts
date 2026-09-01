import { describe, expect, it } from 'vitest';
import {
  lpoReceiptSchema,
  lpoSchema,
  purchaseInvoiceSchema,
  supplierPaymentSchema,
} from '@marble/types';

describe('Supplier purchasing contracts', () => {
  it('requires a supplier and at least one positive LPO line', () => {
    expect(lpoSchema.parse({
      supplierId: 'supplier-1',
      lines: [{ productName: 'Marble slab', orderedQty: '2', unitCost: '100' }],
    })).toMatchObject({ supplierId: 'supplier-1', lines: [{ orderedQty: 2, unitCost: 100, unit: 'unit' }] });
    expect(() => lpoSchema.parse({ supplierId: 'supplier-1', lines: [] })).toThrow();
  });

  it('validates receipt quantities and purchase invoice totals inputs', () => {
    expect(lpoReceiptSchema.parse({
      receiptDate: '2026-08-31',
      lines: [{ lpoLineId: 'line-1', receivedQty: '1' }],
    }).lines[0].receivedQty).toBe(1);
    expect(purchaseInvoiceSchema.parse({
      supplierId: 'supplier-1',
      issueDate: '2026-08-31',
      lines: [{ productName: 'Adhesive', qty: '3', unitCost: '25' }],
    }).lines[0].qty).toBe(3);
  });

  it('does not allow payment allocations above the payment amount contract', () => {
    expect(supplierPaymentSchema.parse({
      supplierId: 'supplier-1',
      paidAt: '2026-08-31',
      amount: '100',
      method: 'bank_transfer',
      allocations: [{ purchaseInvoiceId: 'invoice-1', amount: '100' }],
    }).allocations[0].amount).toBe(100);
    expect(() => supplierPaymentSchema.parse({
      supplierId: 'supplier-1',
      paidAt: '2026-08-31',
      amount: '100',
      method: 'bank_transfer',
      allocations: [{ purchaseInvoiceId: 'invoice-1', amount: '101' }],
    })).toThrow();
  });
});
