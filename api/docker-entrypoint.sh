#!/bin/sh
# Apply pending migrations, seed the story cast (idempotent), then start the API.
set -e

echo "→ applying database migrations"
npx prisma migrate deploy

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "→ seeding zones and the Banani story cast"
  node dist/db/seed.js
fi

echo "→ starting Oi Tesla API"
exec node dist/server.js
