# Marble with Nuage

Multi-company marble business SaaS — web (Next.js) + mobile (Expo) + NestJS API.

## Phase 0 — local run

```bash
pnpm install
pnpm db:push
pnpm db:seed

pnpm dev:api      # http://localhost:3001
pnpm dev:web      # http://localhost:3000
pnpm dev:mobile   # Expo Go (SDK 54) — scan QR on iPhone
```

Bootstrap company: **Binhaj Marble**  
Bootstrap token: see `apps/api/.env` (`BOOTSTRAP_TOKEN`)

Local DB is SQLite for now (no Docker). Schema is Postgres-ready.
