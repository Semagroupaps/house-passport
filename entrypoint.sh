#!/bin/sh
# Bootstrap er BEST-EFFORT: hvis det fejler, starter appen ALLIGEVEL, så proxyen
# har en kørende server (ingen "no available server"), og /health kan vise, hvad
# der er galt. set -e bruges bevidst IKKE.

if [ -n "$ADMIN_DATABASE_URL" ]; then
  echo "[entrypoint] Bootstrapper database (skema + RLS)..."
  i=0; ok=0
  while [ "$i" -lt 10 ]; do
    if DATABASE_URL="$ADMIN_DATABASE_URL" npx prisma db push --skip-generate; then ok=1; break; fi
    i=$((i+1)); echo "[entrypoint] Afventer database... ($i/10)"; sleep 3
  done
  if [ "$ok" = "1" ]; then
    if DATABASE_URL="$ADMIN_DATABASE_URL" npx prisma db execute --file prisma/sql/security.sql --schema prisma/schema.prisma; then
      echo "[entrypoint] Bootstrap fuldført."
    else
      echo "[entrypoint] ADVARSEL: security.sql fejlede (rolle/RLS/pgvector?). Appen starter alligevel — se /health og /v1-fejl."
    fi
  else
    echo "[entrypoint] ADVARSEL: databasen kunne ikke nås. Appen starter alligevel; /health viser db=down."
  fi
else
  echo "[entrypoint] ADMIN_DATABASE_URL ikke sat — springer bootstrap over (DB vil være tom)."
fi

echo "[entrypoint] Starter app på port ${PORT:-3000}..."
exec node dist/main.js
