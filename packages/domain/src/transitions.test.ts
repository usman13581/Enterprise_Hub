import { describe, expect, it } from 'vitest';
import {
  canApproveQuotation,
  canCancelQuotation,
  canCloseJob,
  canCompleteJob,
  canEditQuotation,
  canInvoiceJob,
  canRecordAdvanceForJob,
} from './transitions';

describe('quotation transitions', () => {
  it('only allows editing, approving, and cancelling a draft', () => {
    expect(canEditQuotation('draft')).toBe(true);
    expect(canApproveQuotation('draft')).toBe(true);
    expect(canCancelQuotation('draft')).toBe(true);
  });

  it('locks an approved quotation', () => {
    expect(canEditQuotation('approved')).toBe(false);
    expect(canApproveQuotation('approved')).toBe(false);
    expect(canCancelQuotation('approved')).toBe(false);
  });

  it('locks a cancelled quotation', () => {
    expect(canEditQuotation('cancelled')).toBe(false);
    expect(canApproveQuotation('cancelled')).toBe(false);
  });
});

describe('job transitions', () => {
  it('completes only from open', () => {
    expect(canCompleteJob('open')).toBe(true);
    expect(canCompleteJob('completed')).toBe(false);
    expect(canCompleteJob('closed')).toBe(false);
  });

  it('closes from open or completed but never twice', () => {
    expect(canCloseJob('open')).toBe(true);
    expect(canCloseJob('completed')).toBe(true);
    expect(canCloseJob('closed')).toBe(false);
  });

  it('allows a final invoice after completion but nothing after close', () => {
    expect(canInvoiceJob('open')).toBe(true);
    expect(canInvoiceJob('completed')).toBe(true);
    expect(canInvoiceJob('closed')).toBe(false);
  });

  it('stops advances on a closed job', () => {
    expect(canRecordAdvanceForJob('open')).toBe(true);
    expect(canRecordAdvanceForJob('closed')).toBe(false);
  });
});
