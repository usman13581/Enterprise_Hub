# Advances navigation plan

## Recommendation

Move **Advances** out of the **Work** group and place it in a dedicated **Finance** group:

1. Accounts
2. Advances

This makes the relationship clear: Accounts is the financial overview, while Advances is the transaction screen for customer money received before or between invoices. Invoices remain under Work because they are part of the sales/job workflow.

The same grouping and order should be used on web and mobile:

```text
Home
Work
  Customers
  Suppliers
  Products
  Quotations
  Jobs
  Invoices
Finance
  Accounts
  Advances
Insights
  Reports
  Audit
Account
  Notifications
  Company profile
  Team / Subscription / Support
```

## Behaviour

- Keep the existing route `/advances`; do not break bookmarks, deep links, or API routes.
- Keep the existing Advances page and permissions unchanged.
- Update only navigation grouping, labels, icons, active-state handling, and mobile section order.
- Keep Advances accessible from customer and job hubs where it is already relevant.
- Add a short description: “Customer payments received before invoice allocation.”
- Use a finance-oriented icon consistently on web and mobile.
- Preserve active highlighting when the user is on `/advances` or a future `/advances/:id` route.

## Files

- `packages/types/src/nav.ts` — retain the route and add navigation metadata/section if the shared nav model is extended.
- `apps/web/components/AppShell.tsx` — remove `advances` from `workKeys`; add a Finance group with Accounts then Advances.
- `apps/mobile/app/index.tsx` — remove `advances` from Work; add a Finance section with Accounts then Advances.
- Existing advances pages — no business logic changes.

## Acceptance criteria

- Web and mobile show Advances under **Finance**, directly after Accounts.
- Advances is no longer shown under Work.
- `/advances` opens exactly as before.
- Customers, jobs, invoices, and accounts still link to advances correctly.
- The current active route is highlighted on both clients.
- No API, database, offline-sync, or accounting behaviour changes.
