# Marble with Nuage

Multi-company marble business SaaS — web (Next.js) + mobile (Expo) + NestJS API.

## Phase status

| Phase | Status |
|-------|--------|
| 0 Foundation | Done |
| 1 Catalog + CRM | Done |
| 2 Quotations + Jobs | Done |
| 3 Accounts + invoicing + PDFs | Done |
| 4 Offline mobile sync | Done |
| 5 Binhaj pilot polish | Done |
| Later auth product | Implemented on origin |
| HR module | Planned — see [docs/HR_MODULE.md](docs/HR_MODULE.md) |
| Advances navigation | Planned — see [docs/ADVANCES_NAVIGATION.md](docs/ADVANCES_NAVIGATION.md) |

## Local run

```bash
pnpm install
pnpm build:packages   # shared types / domain / PDF (also runs via prepare)
docker compose up -d postgres
cp apps/api/.env.example apps/api/.env
pnpm db:push
pnpm db:seed          # Binhaj catalog + villa job money path

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

Database is **PostgreSQL** (local via `docker compose`, production via Railway).

## Deploy on Railway

See **[docs/RAILWAY.md](docs/RAILWAY.md)** for step-by-step Railway setup (Postgres + API + Web).

## Verify

```bash
pnpm verify   # generate Prisma client, typecheck, test, build
```

Automated coverage today:

- 71 domain unit tests (VAT, fils rounding, advance allocation, ledgers, transitions, sync conflicts)
- 95 API integration tests (validation, tenancy, money path, PDFs, sync push/pull)

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
- **Mobile offline:** Expo SQLite cache, `GET /sync/pull` + `POST /sync/push`, mutation + image upload queues, Sync now on home

## Offline sync notes

- Draft quotations + catalog/CRM: last-write-wins by `version` / `updatedAt`
- Approved / cancelled quotations, issued invoices, completed/closed jobs: **server wins**
- New invoices and advances still need the REST APIs (ledger consistency); while offline they queue and flush on reconnect
- Images: local URI → upload queue → `POST /uploads` → product image attach
