# Upcoming: finance reports

Delete this file when the **non-invoice** finance backlog is done. Invoice pack: [INVOICE_REPORTS.md](./INVOICE_REPORTS.md). Platform admin: [PLATFORM_ADMIN.md](./PLATFORM_ADMIN.md). Index: [README.md](./README.md).

Develop **one report at a time**. Every report ships on **web and mobile**: parameters → short on-screen summary → table → Print PDF with the same parameters. No chart of accounts.

## Locked rules

- No chart of accounts, journals, trial balance, or company balance sheet.
- No `ChartOfAccount` / `JournalEntry` tables.
- Same API and numbers on web and mobile. Layout may differ; behaviour may not. **Every report is on both.**
- Screen first, print second. Print PDF on **web and mobile**. Never PDF-only, never web-only.
- Math in `packages/domain`. PDF header/footer in `packages/pdf` (logo, TRN, bank, reconciling footer).
- Sources only: `LedgerEntry`, `Invoice`, `AdvancePayment`, `Job` + existing `jobFinancials` / `summarizeLedger` / `withRunningBalance`.
- Default period = this month. Default as-of = today.

## Language

- **Balance due** / receivable — not GL codes
- **Planned margin** vs **completed-job profit** — cash collected is not profit
- **Unallocated advances** — money on account
- **Unbilled** — job value minus invoiced

## How each report looks

1. Reports nav (add to `packages/types/src/nav.ts`)
2. Parameters: from/to, as-of, customer, job — only what that report needs
3. Short summary: 3–6 stat cards
4. Presentable table (scroll on mobile; same columns as PDF)
5. Print PDF — same params; footer ties the total (e.g. sum of balances = company AR)

```
Reports → parameters → GET /reports/:key
                      → summary + table
                      → GET /reports/:key/pdf  (same params)
```

Reuse `Stat` / `BalanceStat` / `LedgerTable` / `PdfButton` on web and the mobile finance equivalents.

---

## Wave 1 — build in this order

Tick when done on **both** web and mobile.

- [ ] **1. Reports shell** — nav, parameters, summary + table layout, Print PDF button
- [ ] **2. Customer statement of account** — opening / movements / closing; optional job filter
- [ ] **3. Customer balances (as-of)** — billed, received, due; footer sums to company AR
- [ ] **4. Aged receivables** — invoice `dueDate`; FIFO leftover advances onto oldest invoices
- [ ] **5. Job costing / job P&L sheet** — job value, invoiced, remaining, cost, planned margin
- [ ] **6. Customer-wise margin** — same job formula, grouped by customer
- [ ] **7. Monthly P&L** — invoiced net vs margin of jobs **completed** in the month
- [ ] **8. Invoice reports pack** — full checklist in [INVOICE_REPORTS.md](./INVOICE_REPORTS.md) (INV-1–10 now, INV-11–15 in Wave 2). Every view: web + mobile + PDF.
- [ ] **9. Advance / receipts register** — method, reference, allocated / unallocated
- [ ] **10. Unallocated advances** — money held on account
- [ ] **11. Billing progress / unbilled** — job value vs invoiced to date vs remaining
- [ ] **12. Advance allocation rec** — advance = allocated + leftover; invoice applied = sum of allocations

### Wave 1 parameters

| Report | From/to | As-of | Customer | Job |
| --- | --- | --- | --- | --- |
| Statement | yes | | yes | optional |
| Customer balances | | yes | optional | |
| Aged receivables | | yes | optional | |
| Job costing | | | | yes |
| Customer-wise margin | optional | | optional | |
| Monthly P&L | yes | | | |
| Invoice pack (all views) | yes | optional as-of for outstanding | optional | optional |
| Advance register | yes | | optional | optional |
| Unallocated advances | | yes | optional | |
| Unbilled | | yes | optional | optional |
| Allocation rec | yes | | optional | |

Extra invoice filters: see [INVOICE_REPORTS.md](./INVOICE_REPORTS.md).

---

Invoice pack (all perspectives, columns, Pack A/B): **[INVOICE_REPORTS.md](./INVOICE_REPORTS.md)**.

---

## Wave 2 — after Wave 1

Invoice Pack B: [INVOICE_REPORTS.md](./INVOICE_REPORTS.md) INV-11–15, plus:

- [ ] **13. VAT working paper** — output VAT by month minus credit notes (summary; INV-12 is the invoice drill-down)
- [ ] **14. Overdue / collections** — aging buckets (INV-9 is the invoice list; this is the aged AR worklist)
- [ ] **16. Cash by payment method**
- [ ] **17. Material / product margin** — quote line purchase vs sell
- [ ] **18. Supplier spend analysis** — quote/invoice cost by `product.supplierId`
- [ ] **19. Quotation pipeline** — draft vs approved vs cancelled
- [ ] **20. CSV export** of the same reports (including every invoice view)

---

## Out of scope (do not build unless asked)

- Bank reconciliation
- Supplier aged payables (quote purchase price is costing, not AP)
- Company P&L / trial balance / balance sheet
- FTA VAT201 / e-invoicing
- Inventory / stock valuation
- Customer confirmation letters (easy later: statement + sign-back block)

---

## Implementation notes

- API: `GET /reports/:key?...params` — company-scoped, same auth as accounts
- PDF: `GET /reports/:key/pdf?...params`
- Wave 1: no new Prisma models
- Order of work per report: domain + API → web screen → mobile screen → **PDF** (no report ships without Print)
