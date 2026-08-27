#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Railway API start"
echo "    NODE_ENV=${NODE_ENV:-}"
echo "    PORT=${PORT:-}"
echo "    HOST=${HOST:-}"
echo "    DATABASE_URL set: $([ -n "${DATABASE_URL:-}" ] && echo yes || echo NO)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is missing"
  exit 1
fi

if [ ! -f apps/api/dist/main.js ]; then
  echo "ERROR: apps/api/dist/main.js missing — image was not built correctly"
  exit 1
fi

echo "==> Applying database schema (prisma db push)..."
pnpm --filter @marble/api exec prisma db push --skip-generate --accept-data-loss

echo "==> Seeding pilot data (idempotent upserts)..."
pnpm --filter @marble/api db:seed || {
  echo "WARNING: db:seed failed — API will still start. Run seed from Railway shell."
}

echo "==> Starting Nest API..."
# Always bind all interfaces inside the container (Railway routes to $PORT).
export HOST=0.0.0.0
exec pnpm --filter @marble/api start
