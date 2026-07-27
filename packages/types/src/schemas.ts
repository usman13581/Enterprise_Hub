import { z } from 'zod';
import {
  INVOICE_KINDS,
  PAYMENT_METHODS,
  QUOTATION_STATUSES,
} from './enums';

/** Trims, then treats a blank string as "not provided". */
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullish()
    .transform((value) => value ?? null);

const requiredText = (max = 200) => z.string().trim().min(1).max(max);

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .transform((value) => (value.length === 0 ? null : value))
  .nullish()
  .transform((value) => value ?? null)
  .refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    { message: 'must be a valid email address' },
  );

/**
 * Accepts a number or a numeric string so form payloads and curl both work,
 * but rejects NaN and Infinity, which previously reached Prisma and surfaced
 * as HTTP 500 instead of a validation error.
 */
const numeric = z.union([z.number(), z.string().trim().min(1)]).transform(
  (value, ctx) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a number' });
      return z.NEVER;
    }
    return parsed;
  },
);

/** Money never goes negative in this system; reversals use credit notes. */
export const money = numeric.refine((value) => value >= 0, {
  message: 'must be zero or greater',
});

export const positiveMoney = numeric.refine((value) => value > 0, {
  message: 'must be greater than zero',
});

export const quantity = numeric.refine((value) => value > 0, {
  message: 'must be greater than zero',
});

const isoDate = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'must be a valid date',
  })
  .nullish()
  .transform((value) => value ?? null);

export const supplierSchema = z.object({
  name: requiredText(),
  contact: optionalText(200),
  phone: optionalText(60),
  email: optionalEmail,
  address: optionalText(),
  trn: optionalText(60),
  notes: optionalText(2000),
  active: z.boolean().optional(),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const customerSchema = supplierSchema;
export type CustomerInput = z.infer<typeof customerSchema>;

export const productSchema = z.object({
  name: requiredText(),
  sku: optionalText(80),
  unit: z.string().trim().min(1).max(20).default('sqm'),
  purchasePrice: money.default(0),
  sellPrice: money.default(0),
  description: optionalText(2000),
  supplierId: optionalText(60),
  active: z.boolean().optional(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const companyProfileSchema = z.object({
  legalName: requiredText(),
  tradeName: optionalText(200),
  address: optionalText(),
  phone: optionalText(60),
  email: optionalEmail,
  trn: optionalText(60),
  bankDetails: optionalText(1000),
  logoUrl: optionalText(1000),
  signatureUrl: optionalText(1000),
  quotationPrefix: z.string().trim().min(1).max(12).default('QT'),
  invoicePrefix: z.string().trim().min(1).max(12).default('INV'),
  jobPrefix: z.string().trim().min(1).max(12).default('JOB'),
  advancePrefix: z.string().trim().min(1).max(12).default('ADV'),
  creditNotePrefix: z.string().trim().min(1).max(12).default('CN'),
  currency: z.string().trim().length(3).default('AED'),
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const quotationLineSchema = z.object({
  productId: optionalText(60),
  description: requiredText(300),
  unit: z.string().trim().min(1).max(20).default('sqm'),
  qty: quantity,
  purchasePrice: money,
  sellPrice: money,
});
export type QuotationLineInput = z.infer<typeof quotationLineSchema>;

export const quotationSchema = z.object({
  customerId: requiredText(60),
  title: optionalText(200),
  notes: optionalText(2000),
  validUntil: isoDate,
  lines: z.array(quotationLineSchema).min(1, 'at least one line is required'),
});
export type QuotationInput = z.infer<typeof quotationSchema>;

export const quotationStatusFilter = z.enum(QUOTATION_STATUSES).optional();

export const invoiceLineSchema = z.object({
  description: requiredText(300),
  unit: z.string().trim().min(1).max(20).default('sqm'),
  qty: quantity,
  unitPrice: money,
  purchasePrice: money.default(0),
});
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;

export const invoiceSchema = z.object({
  kind: z.enum(INVOICE_KINDS).exclude(['credit_note']),
  customerId: requiredText(60),
  jobId: optionalText(60),
  issueDate: isoDate,
  dueDate: isoDate,
  notes: optionalText(2000),
  lines: z.array(invoiceLineSchema).min(1, 'at least one line is required'),
  /** Advances to show as settled on this invoice. */
  allocations: z
    .array(
      z.object({
        advanceId: requiredText(60),
        amount: positiveMoney,
      }),
    )
    .default([]),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const creditNoteSchema = z.object({
  invoiceId: requiredText(60),
  reason: requiredText(500),
  lines: z.array(invoiceLineSchema).min(1, 'at least one line is required'),
});
export type CreditNoteInput = z.infer<typeof creditNoteSchema>;

export const advanceSchema = z.object({
  customerId: requiredText(60),
  jobId: optionalText(60),
  amount: positiveMoney,
  method: z.enum(PAYMENT_METHODS).default('cash'),
  reference: optionalText(120),
  receivedAt: isoDate,
  notes: optionalText(2000),
});
export type AdvanceInput = z.infer<typeof advanceSchema>;

export const progressiveInvoiceSchema = z.object({
  /** Bill a share of the job value without listing lines by hand. */
  percentage: numeric
    .refine((value) => value > 0 && value <= 100, {
      message: 'must be between 0 and 100',
    })
    .optional(),
  amount: positiveMoney.optional(),
  description: optionalText(300),
  issueDate: isoDate,
  dueDate: isoDate,
  notes: optionalText(2000),
  allocations: z
    .array(
      z.object({
        advanceId: requiredText(60),
        amount: positiveMoney,
      }),
    )
    .default([]),
});
export type ProgressiveInvoiceInput = z.infer<typeof progressiveInvoiceSchema>;

/** Entities the mobile offline engine may push or pull. */
export const SYNC_ENTITY_KEYS = [
  'profile',
  'supplier',
  'product',
  'productImage',
  'customer',
  'quotation',
  'job',
  'invoice',
  'advance',
] as const;

export const syncMutationSchema = z.object({
  /** Client-stable id so retries are idempotent. */
  clientMutationId: requiredText(80),
  entity: z.enum(SYNC_ENTITY_KEYS),
  op: z.enum(['upsert', 'delete']),
  id: requiredText(60),
  updatedAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'must be a valid ISO timestamp',
    }),
  version: z.number().int().positive(),
  /** Full row payload for upsert; ignored for delete. */
  data: z.record(z.unknown()).optional(),
});
export type SyncMutation = z.infer<typeof syncMutationSchema>;

export const syncPushSchema = z.object({
  mutations: z.array(syncMutationSchema).max(200),
});
export type SyncPushInput = z.infer<typeof syncPushSchema>;
