# Upcoming: invoice reports

Delete this file when the invoice pack is done. Related: [FINANCE_REPORTS.md](./FINANCE_REPORTS.md) (AR, P&L, advances) and [PLATFORM_ADMIN.md](./PLATFORM_ADMIN.md).

Every invoice view ships on **web and mobile**: parameters → short summary → table → **Print PDF** (same parameters). Never PDF-only or web-only.

Invoices in this product are **UAE tax invoices / credit notes on a job**, not supplier bills.

## Locked rules

- Same numbers as the invoice PDF: `subtotal + vatAmount = total`, `total − advanceApplied = netPayable` (fils in `packages/domain`).
- Credit notes reverse billed value and VAT; show them clearly so the register still ties.
- Cancelled invoices stay in numbering/control reports; they do not add to billed totals.
- Filters: from/to (`issueDate`), customer, job, kind (`progressive` | `custom` | `final` | `credit_note` | all), status (`issued` | `cancelled` | all). Outstanding/overdue also use `dueDate` and as-of (default today).
- Default period = this month.
- API: `GET /reports/invoices/:view?...params` and `GET /reports/invoices/:view/pdf?...params`
- Order: domain + API → web → mobile → PDF. **Each INV view must exist on both clients with Print.**

## Shared summary cards

Count · Taxable · VAT 5% · Gross · Advances applied · Net payable

Footer identity: sum of row gross = summary gross (issued only, unless the view is cancelled/numbering).

---

## Pack A — build first (tick web + mobile + PDF)

- [ ] **INV-1 Master register**  
  Columns: number, kind, status, customer, job, issue date, due date, taxable, VAT, gross, advance applied, net payable.  
  Default: issued, this month.

- [ ] **INV-2 By customer**  
  Same rows grouped by customer. Group subtotal + grand total.

- [ ] **INV-3 By job**  
  Grouped by job (include “no job” if any). Group subtotal + grand total.

- [ ] **INV-4 By kind**  
  Four buckets: progressive, custom, final, credit note. Count + taxable + VAT + gross per kind.

- [ ] **INV-5 By status**  
  Issued vs cancelled. Cancelled listed so the number series is complete; money totals issued-only unless you print the cancelled view.

- [ ] **INV-6 Monthly summary**  
  One row per calendar month: count, taxable, VAT, gross, credit-note gross, net billed.

- [ ] **INV-7 Credit notes**  
  CN number, original invoice, customer, job, issue date, taxable, VAT, gross. Footer: CNs reverse billed and VAT.

- [ ] **INV-8 Outstanding**  
  Issued, not cancelled. Net payable as-of. Apply leftover **unallocated advances FIFO** (same as aged AR) so cash on account is not double-counted.

- [ ] **INV-9 Overdue**  
  Outstanding where due date (or issue date if no due) is before as-of. Collections print.

- [ ] **INV-10 Advances on invoices**  
  One row per allocation: invoice number, advance number, amount, date. Control: sum per invoice = `invoice.advanceApplied`.

---

## Pack B — tax and control (after Pack A)

- [ ] **INV-11 UAE tax listing**  
  Number, issue date, buyer name, buyer TRN, taxable, VAT 5%, gross. Audit list — not FTA e-invoicing.

- [ ] **INV-12 VAT drill-down**  
  Invoice-level issued VAT minus credit-note VAT by month. Ties to finance VAT working paper.

- [ ] **INV-13 Numbering / gaps**  
  Sorted invoice numbers in the period; flag missing or duplicate. Not a money report.

- [ ] **INV-14 Cancelled**  
  Number, cancelledAt, customer, original totals. Optional actor from audit.

- [ ] **INV-15 Lines / product**  
  Invoice, line description, qty, unit price, purchase snapshot, line total. Optional product filter.

---

## Perspectives (what each answers)

| View | Question |
| --- | --- |
| INV-1 | What documents exist? |
| INV-2 | What did we bill this customer? |
| INV-3 | How much of this job is invoiced? |
| INV-4 | Progressive vs final vs credit? |
| INV-5 / INV-14 | Issued vs voided? |
| INV-6 | What did we bill this month? |
| INV-7 | What did we reverse? |
| INV-8 / INV-9 | What is still collectible / late? |
| INV-10 | What cash was applied on the tax invoice? |
| INV-11 / INV-12 | What VAT did we charge? |
| INV-13 | Is numbering clean? |
| INV-15 | What did we bill at line level? |

**Not in this pack:** supplier AP, FTA XML, inventory, chart of accounts.

---

## UI

- Reports → Invoices → pick view (tabs or list). Same views on mobile.
- Parameters bar, then 3–6 stats, then scrollable table, then **Print PDF**.
- PDF: company logo, TRN, date range, filters printed in the header, reconciling footer.

Reuse existing invoice PDFs for a **single** document; these reports are **lists** of many invoices.
