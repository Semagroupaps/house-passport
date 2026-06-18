#!/bin/sh
set -e

# Bootstrap databasen (skema + RLS) som admin, hvis ADMIN_DATABASE_URL er sat.
# Tåler at databasen endnu ikke er klar (retry), så start-races på Coolify håndteres.
if [ -n "$ADMIN_DATABASE_URL" ]; then
  echo "[entrypoint] Bootstrapper database (skema + RLS)..."
  i=0
  until DATABASE_URL="$ADMIN_DATABASE_URL" npx prisma db push --skip-generate; do
    i=$((i+1))
    if [ "$i" -ge 10 ]; then echo "[entrypoint] Databasen blev ikke klar i tide."; exit 1; fi
    echo "[entrypoint] Afventer database... ($i/10)"; sleep 3
  done
  DATABASE_URL="$ADMIN_DATABASE_URL" npx prisma db execute \
    --file prisma/sql/security.sql --schema prisma/schema.prisma
  echo "[entrypoint] Bootstrap fuldført."
else
  echo "[entrypoint] ADMIN_DATABASE_URL ikke sat — springer bootstrap over."
fi

exec node dist/main.js
