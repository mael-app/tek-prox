#!/bin/sh
set -e

# Apply any pending migrations before starting the server.
# DATABASE_URL must be set (e.g. file:/data/dev.db).
echo "Running database migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "Starting server..."
exec node server.js
