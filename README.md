# Marble with Nuage

Multi-company marble business SaaS — web (Next.js) + mobile (Expo) + NestJS API.

## Phase status

| Phase | Status |
|-------|--------|
| 0 Foundation | Done |
| 1 Catalog + CRM | Done |
| 2 Quotations + Jobs | Done |
| 3 Accounts + invoicing + PDFs | Done |
| 4 Offline mobile sync | Not started |
| 5 Binhaj pilot polish | Not started |
| Later auth product | Deferred |

## Local run

```bash
pnpm install
pnpm build:packages   # shared types / domain / PDF (also runs via prepare)
pnpm db:push
pnpm db:seed

pnpm dev:api      # http://localhost:3001
pnpm dev:web      # http://localhost:3000
pnpm dev:mobile   # Expo Go (SDK 54) — scan QR on iPhone
```

Copy env templates first if you need overrides:

- `apps/api/.env.example` → `apps/api/.env`
- `apps/web/.env.example` → `apps/web/.env.local`
- `apps/mobile/.env.example` → `apps/mobile/.env`

Bootstrap company: **Binhaj Marble**  
Bootstrap token: `binhaj-dev-token` (or whatever you set as `BOOTSTRAP_TOKEN`)

Local DB is SQLite for now (no Docker). Schema is Postgres-ready.

## Verify

```bash
pnpm verify   # generate Prisma client, typecheck, test, build
```

Automated coverage today:

- 67 domain unit tests (VAT, fils rounding, advance allocation, ledgers, transitions)
- 91 API integration tests (validation, company isolation, quotation→job→invoice money path, PDFs)

## What works on web and mobile

- Suppliers, products (with images), customers
- Company profile + audit
- Quotations with per-line purchase/sell, approve → job, cancel
- Jobs hub: progressive / custom / final invoices, advances, complete / close, ledger, margin
- Customer hub: receivable, advances, docs, ledger
- Invoices dashboard + credit notes
- Advances receipts
- Accounts overview (AR + margin by job)
- UAE tax invoice / quotation / advance-receipt PDFs
