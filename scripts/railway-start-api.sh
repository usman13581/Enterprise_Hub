#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Railway API start (cwd: $(pwd))"

if [ ! -f apps/api/dist/main.js ]; then
  echo "==> dist/main.js missing — running production build..."
  pnpm railway:build:api
fi

echo "==> Applying database schema..."
pnpm --filter @marble/api db:push

echo "==> Starting Nest API..."
pnpm --filter @marble/api start
