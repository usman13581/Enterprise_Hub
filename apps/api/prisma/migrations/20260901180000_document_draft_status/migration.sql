-- Sales invoices and supplier payments start as drafts until issued/approved.
-- Existing live documents stay issued/posted.

ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'draft';

ALTER TABLE "AdvancePayment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'posted';
UPDATE "AdvancePayment" SET "status" = 'cancelled' WHERE "cancelledAt" IS NOT NULL;
UPDATE "AdvancePayment" SET "status" = 'posted' WHERE "cancelledAt" IS NULL;
ALTER TABLE "AdvancePayment" ALTER COLUMN "status" SET DEFAULT 'draft';

ALTER TABLE "SupplierPayment" ALTER COLUMN "status" SET DEFAULT 'draft';
