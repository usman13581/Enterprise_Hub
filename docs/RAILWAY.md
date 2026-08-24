# Deploy on Railway

Deploy **PostgreSQL**, **API**, and **Web** as three Railway resources from this monorepo.

## 1. Push to GitHub

Ensure the latest code is on `origin` (this repo).

## 2. Create Railway project

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → select this repo.
2. **+ New** → **Database** → **PostgreSQL**.

## 3. API service

1. **+ New** → **GitHub Repo** → same repository.
2. Rename service to `marble-api`.
3. **Settings** → **Config file path** → `railway.api.toml`
4. **Variables**:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | long random secret |
| `JWT_EXPIRES_IN` | `7d` |
| `BOOTSTRAP_TOKEN` | strong token (optional tooling) |
| `BOOTSTRAP_COMPANY_SLUG` | `binhaj-marble` |
| `HOST` | `0.0.0.0` |
| `CORS_ORIGINS` | your web URL (set after web deploy) |

5. **Networking** → **Generate domain** → note the API URL.

6. **One-time seed** (Shell on API service):

```bash
pnpm --filter @marble/api db:seed
```

Login after seed: `owner@binhajmarble.ae` / `binhaj123` (or `SEED_OWNER_PASSWORD`).

## 4. Web service

1. **+ New** → same repo → rename `marble-web`.
2. **Settings** → **Config file path** → `railway.web.toml`
3. **Variables**:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | API public URL from step 3 |
| `NEXT_PUBLIC_BOOTSTRAP_TOKEN` | same as API `BOOTSTRAP_TOKEN` |

4. **Generate domain** for web.
5. Update API `CORS_ORIGINS` to include the web URL → redeploy API.

## 5. Mobile

Point Expo at production:

```env
EXPO_PUBLIC_API_URL=https://your-api.up.railway.app
EXPO_PUBLIC_BOOTSTRAP_TOKEN=your-bootstrap-token
```

## Uploads (product images)

Files are stored under `uploads/` on the API container disk. Railway disks are ephemeral unless you attach a **Volume** mounted at `uploads`. For production pilots, add a volume or plan object storage (S3/R2).

## Local development with Postgres

```bash
docker compose up -d postgres
cp apps/api/.env.example apps/api/.env   # uses postgresql://marble:marble@localhost:5432/marble
pnpm db:push
pnpm db:seed
pnpm dev:api
pnpm dev:web
```
