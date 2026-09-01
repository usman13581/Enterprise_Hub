import { z } from 'zod';
import { isCountryCode } from './countries';
import {
  DISCOUNT_MODES,
  INVOICE_KINDS,
  PAYMENT_METHODS,
  QUOTATION_KINDS,
  QUOTATION_LOOKUP_APPLIES_TO,
  QUOTATION_LOOKUP_CATEGORIES,
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

export const discountModeSchema = z.enum(DISCOUNT_MODES).default('none');

/** Reusable line or document discount fields. */
export const discountFieldsSchema = z
  .object({
    discountMode: discountModeSchema,
    discountValue: money.default(0),
    /** Legacy counter-top fixed discount (AED). */
    discount: money.default(0).optional(),
  })
  .transform((data) => {
    if (data.discountMode !== 'none' || data.discountValue > 0) {
      return {
        discountMode: data.discountMode,
        discountValue: data.discountValue,
      };
    }
    if ((data.discount ?? 0) > 0) {
      return { discountMode: 'fixed' as const, discountValue: data.discount! };
    }
    return { discountMode: 'none' as const, discountValue: 0 };
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
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2)
    .refine(isCountryCode, { message: 'must be a supported country' })
    .optional(),
  /** Ignored when country is present; currency is always derived from country. */
  currency: z.string().trim().length(3).optional(),
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const quotationLineSchema = z.object({
  productId: optionalText(60),
  description: requiredText(300),
  unit: z.string().trim().min(1).max(20).default('sqm'),
  qty: quantity,
  purchasePrice: money,
  sellPrice: money,
  discountMode: discountModeSchema,
  discountValue: money.default(0),
});
export type QuotationLineInput = z.infer<typeof quotationLineSchema>;

export const quotationSectionItemSchema = z.object({
  label: requiredText(120),
  value: z.string().trim().max(500).default(''),
  amount: money.default(0),
  discountMode: discountModeSchema,
  discountValue: money.default(0),
});
export type QuotationSectionItemInput = z.infer<
  typeof quotationSectionItemSchema
>;

export const quotationSectionSchema = z.object({
  productId: optionalText(60),
  productName: requiredText(200),
  amount: money,
  discountMode: discountModeSchema,
  discountValue: money.default(0),
  items: z.array(quotationSectionItemSchema).default([]),
});
export type QuotationSectionInput = z.infer<typeof quotationSectionSchema>;

export const quotationSchema = z
  .object({
    kind: z.enum(QUOTATION_KINDS).default('general'),
    customerId: requiredText(60),
    title: optionalText(200),
    notes: optionalText(2000),
    contactName: optionalText(120),
    contactPhone: optionalText(60),
    location: optionalText(200),
    validUntil: isoDate,
    discountMode: discountModeSchema,
    discountValue: money.default(0),
    discount: money.default(0).optional(),
    lookupIds: z.array(requiredText(60)).default([]),
    lines: z.array(quotationLineSchema).default([]),
    sections: z.array(quotationSectionSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.discountMode === 'percent' && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'document discount percent cannot exceed 100',
        path: ['discountValue'],
      });
    }
    if (data.kind === 'general' && data.lines.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at least one line is required',
        path: ['lines'],
      });
    }
    if (data.kind === 'counter_top' && data.sections.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at least one counter top section is required',
        path: ['sections'],
      });
    }
  });
export type QuotationInput = z.infer<typeof quotationSchema>;

export const quotationStatusFilter = z.enum(QUOTATION_STATUSES).optional();

export const quotationLookupSchema = z.object({
  category: z.enum(QUOTATION_LOOKUP_CATEGORIES),
  appliesTo: z.enum(QUOTATION_LOOKUP_APPLIES_TO).default('both'),
  title: requiredText(200),
  body: requiredText(8000),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});
export type QuotationLookupInput = z.infer<typeof quotationLookupSchema>;

export const invoiceLineSchema = z.object({
  description: requiredText(300),
  unit: z.string().trim().min(1).max(20).default('sqm'),
  qty: quantity,
  unitPrice: money,
  purchasePrice: money.default(0),
  discountMode: discountModeSchema,
  discountValue: money.default(0),
});
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;

export const invoiceSchema = z.object({
  kind: z.enum(INVOICE_KINDS).exclude(['credit_note']),
  customerId: requiredText(60),
  jobId: optionalText(60),
  issueDate: isoDate,
  dueDate: isoDate,
  notes: optionalText(2000),
  discountMode: discountModeSchema,
  discountValue: money.default(0),
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
  discountMode: discountModeSchema,
  discountValue: money.default(0),
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

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
  /** Optional when the same email exists in more than one company. */
  companySlug: optionalText(80),
});
export type LoginInput = z.infer<typeof loginSchema>;

const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .length(2)
  .refine(isCountryCode, { message: 'must be a supported country' });

export const demoRequestSchema = z.object({
  companyName: requiredText(200),
  email: z.string().trim().toLowerCase().email().max(200),
  contactName: optionalText(200),
  phone: optionalText(50),
  country: countryCode,
  emirate: optionalText(100),
  approxUsers: optionalText(50),
  note: optionalText(1000),
  honeypot: optionalText(200),
});
export type DemoRequestInput = z.infer<typeof demoRequestSchema>;

export const companyApplicationSchema = z.object({
  legalName: requiredText(200),
  contactName: requiredText(200),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: requiredText(60),
  country: countryCode,
  emirate: optionalText(100),
  tradeName: optionalText(200),
  trn: optionalText(60),
  approxUsers: optionalText(50),
  planInterest: optionalText(100),
  needs: optionalText(2000),
  heardFrom: optionalText(200),
  note: optionalText(2000),
  honeypot: optionalText(200),
});
export type CompanyApplicationInput = z.infer<typeof companyApplicationSchema>;

export const hrEmployeeSchema = z.object({
  firstName: requiredText(100),
  lastName: optionalText(100),
  preferredName: optionalText(100),
  email: optionalEmail,
  phone: optionalText(50),
  nationality: optionalText(100),
  employmentType: requiredText(40).default('full_time'),
  joiningDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), { message: 'must be a valid date' }),
  userId: optionalText(80),
  departmentId: optionalText(80),
  designationId: optionalText(80),
  managerId: optionalText(80),
  status: requiredText(30).default('active'),
  notes: optionalText(1000),
  bankName: optionalText(120),
  bankAccountLast4: optionalText(4),
  ibanLast4: optionalText(4),
  emiratesIdNumber: optionalText(80),
  emiratesIdExpiry: optionalText(40),
  passportNumber: optionalText(80),
  passportCountry: optionalText(100),
  passportExpiry: optionalText(40),
  visaExpiry: optionalText(40),
  workPermitExpiry: optionalText(40),
});
export type HREmployeeInput = z.infer<typeof hrEmployeeSchema>;
export const hrEmployeeUpdateSchema = hrEmployeeSchema.partial();
export type HREmployeeUpdateInput = z.infer<typeof hrEmployeeUpdateSchema>;

export const hrAttendanceCheckInSchema = z.object({
  context: requiredText(30).default('office'),
  workLocationId: optionalText(80),
  latitude: numeric.optional(),
  longitude: numeric.optional(),
  accuracyMeters: numeric.optional(),
  devicePlatform: optionalText(30),
  capturedAt: optionalText(50),
});
export const hrLeaveRequestSchema = z.object({
  employeeId: optionalText(80),
  leaveTypeId: requiredText(80),
  startDate: requiredText(50),
  endDate: requiredText(50),
  reason: optionalText(1000),
});
export const hrOvertimeSchema = z.object({
  employeeId: optionalText(80),
  workDate: requiredText(50),
  startedAt: requiredText(50),
  endedAt: requiredText(50),
  breakMinutes: numeric.refine((value) => Number.isInteger(value) && value >= 0, { message: 'must be a non-negative whole number' }).default(0),
  reason: requiredText(1000),
});
export const hrOrganizationSchema = z.object({
  kind: z.enum(['department', 'designation', 'location', 'holiday']),
  name: requiredText(200),
  date: optionalText(50),
  address: optionalText(500),
  locationKind: optionalText(30),
});
export const hrOrganizationUpdateSchema = z.object({
  kind: z.enum(['department', 'designation', 'location', 'holiday']),
  name: optionalText(200),
  active: z.boolean().optional(),
  date: optionalText(50),
  address: optionalText(500),
  locationKind: optionalText(30),
});
export type HROrganizationInput = z.infer<typeof hrOrganizationSchema>;
export type HROrganizationUpdateInput = z.infer<typeof hrOrganizationUpdateSchema>;
export const hrLeaveTypeSchema = z.object({
  name: requiredText(100),
  code: requiredText(40),
  paid: z.boolean().optional().default(true),
});
export const hrLeaveTypeUpdateSchema = hrLeaveTypeSchema.partial().extend({
  active: z.boolean().optional(),
});
export type HRLeaveTypeInput = z.infer<typeof hrLeaveTypeSchema>;
export type HRLeaveTypeUpdateInput = z.infer<typeof hrLeaveTypeUpdateSchema>;
export const hrApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: optionalText(1000),
  approvedHours: numeric.optional(),
});
export const hrLeaveReviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
  note: optionalText(1000),
});
export const hrExpenseReviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'reimbursed']),
});
export const hrPayrollPeriodSchema = z.object({
  name: requiredText(100),
  startDate: requiredText(50),
  endDate: requiredText(50),
  payDate: optionalText(50),
});
export const hrPayrollStatusSchema = z.object({
  status: z.enum(['approved', 'locked', 'paid']),
});

export const lpoLineSchema = z.object({
  productId: optionalText(80),
  productName: requiredText(300),
  unit: requiredText(30).default('unit'),
  orderedQty: numeric.refine((value) => value > 0, { message: 'must be greater than zero' }),
  unitCost: money,
  vatRate: numeric.refine((value) => value >= 0 && value <= 1, { message: 'must be between 0 and 1' }).default(0.05),
  discountMode: discountModeSchema,
  discountValue: money.default(0),
});

export const lpoSchema = z.object({
  supplierId: requiredText(80),
  requestedDeliveryDate: optionalText(50),
  notes: optionalText(2000),
  discountMode: discountModeSchema,
  discountValue: money.default(0),
  lines: z.array(lpoLineSchema).min(1).max(200),
});

export const lpoReceiptSchema = z.object({
  receiptDate: requiredText(50),
  note: optionalText(1000),
  lines: z.array(z.object({
    lpoLineId: requiredText(80),
    receivedQty: numeric.refine((value) => value > 0, { message: 'must be greater than zero' }),
    varianceNote: optionalText(1000),
  })).min(1).max(200),
});

export const purchaseInvoiceLineSchema = z.object({
  lpoLineId: optionalText(80),
  productId: optionalText(80),
  productName: requiredText(300),
  unit: requiredText(30).default('unit'),
  qty: numeric.refine((value) => value > 0, { message: 'must be greater than zero' }),
  unitCost: money,
  vatRate: numeric.refine((value) => value >= 0 && value <= 1, { message: 'must be between 0 and 1' }).default(0.05),
  discountMode: discountModeSchema,
  discountValue: money.default(0),
});

export const purchaseInvoiceSchema = z.object({
  supplierId: requiredText(80),
  lpoId: optionalText(80),
  supplierInvoiceNumber: optionalText(120),
  issueDate: requiredText(50),
  dueDate: optionalText(50),
  taxInclusive: z.boolean().default(false),
  notes: optionalText(2000),
  discountMode: discountModeSchema,
  discountValue: money.default(0),
  lines: z.array(purchaseInvoiceLineSchema).min(1).max(200),
});

export const supplierPaymentSchema = z.object({
  supplierId: requiredText(80),
  paidAt: requiredText(50),
  amount: positiveMoney,
  method: requiredText(40),
  reference: optionalText(200),
  notes: optionalText(1000),
  allocations: z.array(z.object({
    purchaseInvoiceId: requiredText(80),
    amount: positiveMoney,
  })).max(200).default([]),
}).superRefine((value, context) => {
  const allocated = value.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (allocated > value.amount) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['allocations'], message: 'allocations cannot exceed payment amount' });
  }
});
