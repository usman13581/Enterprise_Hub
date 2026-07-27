export type QuotationStatus = 'draft' | 'approved' | 'cancelled';
export type JobStatus = 'open' | 'completed' | 'closed';

/** Only drafts are editable; approving one creates the job. */
export function canEditQuotation(status: QuotationStatus): boolean {
  return status === 'draft';
}

export function canApproveQuotation(status: QuotationStatus): boolean {
  return status === 'draft';
}

export function canCancelQuotation(status: QuotationStatus): boolean {
  return status === 'draft';
}

export function canCompleteJob(status: JobStatus): boolean {
  return status === 'open';
}

/** A job can be closed from either open or completed, but never twice. */
export function canCloseJob(status: JobStatus): boolean {
  return status === 'open' || status === 'completed';
}

/**
 * V1 rule: a closed job takes no further invoices. Final invoices are the
 * reason `completed` still allows billing — the remainder is settled after the
 * work is done but before the job is closed out.
 */
export function canInvoiceJob(status: JobStatus): boolean {
  return status === 'open' || status === 'completed';
}

export function canRecordAdvanceForJob(status: JobStatus): boolean {
  return status === 'open' || status === 'completed';
}
