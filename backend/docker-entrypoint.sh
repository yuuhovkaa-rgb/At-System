#!/bin/sh
set -e
# Apply migrations if the project has them, otherwise create the schema from schema.prisma.
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  echo "No migrations folder found - using 'prisma db push'. Run 'npx prisma migrate dev --name init' once and commit the result for production."
  npx prisma db push --skip-generate
fi
if [ "$SEED_DEMO_DATA" = "true" ]; then npx tsx prisma/seed.ts --if-empty; fi
exec node dist/server.js
