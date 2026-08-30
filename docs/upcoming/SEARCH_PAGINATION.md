# Upcoming: Search and pagination parity

**Scope:** review every collection and report result screen on web and mobile
for consistent general search and pagination.

## Review inventory

Audit company, finance, quotation, jobs, audit, support, team, subscription,
platform-admin, and report screens on both platforms. Classify each screen as:

- Collection/list — should normally have search and pagination.
- Report result — should retain report-specific filters and add general result
  search/pagination when it returns a collection of rows.
- Dashboard, detail, or form — do not add list controls unless it contains a
  real collection.

Use the existing shared implementations:

- Web: `apps/web/components/ListControls.tsx` and
  `apps/web/lib/useCollection.ts`
- Mobile: `apps/mobile/components/ListControls.tsx` and
  `apps/mobile/lib/useCollection.ts`

Record missing controls, inconsistent search fields or placeholders, pagination
placement, page-size options, result counts, loading states, and empty states.

## Standard behavior

- Place one general search input above each searchable collection.
- Place pagination directly below the collection.
- Include result count/range, previous/next controls, and page-size selection.
- Reset to page one when search, filters, tabs, or page size changes.
- Keep behavior and searchable fields equivalent on web and mobile.
- Use a compact, touch-friendly layout that remains readable on narrow mobile
  screens.
- Keep report-specific filters separate from general row search.

## Report review

Review:

- `apps/web/components/ReportRunner.tsx`
- `apps/web/app/reports/page.tsx`
- `apps/web/app/reports/[key]/page.tsx`
- `apps/web/app/reports/invoices/[view]/page.tsx`
- `apps/mobile/app/module/reports.tsx`

Determine whether each report is a summary, filter-only report, or tabular
result. Add search and pagination only to reports with searchable row results;
do not add controls to summary-only screens.

## Fix and verification

- Add missing shared `SearchBox` and `Pagination` integrations.
- Normalize search fields, placeholders, counts, empty states, and pagination
  placement.
- Verify filtered results cannot leave the user on an invalid page.
- Test empty data, matching and non-matching searches, page changes, page-size
  changes, and filter/tab changes.
- Manually smoke-test company and platform-admin roles on web and mobile.
- Run web and mobile typechecks.

The current helpers paginate data already loaded in the client. If production
datasets become too large, create a follow-up for API-level search and
server-side pagination rather than silently changing this plan.
