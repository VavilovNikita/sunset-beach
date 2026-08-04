#!/bin/sh
set -e

# Postgres is a separate compose project (see docker-compose.prod.yml) with
# no `depends_on`/healthcheck coordination across projects, so on a host
# reboot this container can start before Postgres is accepting connections.
# Retry migrate deploy instead of failing outright on the first attempt.
echo "==> Running prisma migrate deploy"
attempt=1
max_attempts=10
until node node_modules/prisma/build/index.js migrate deploy; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "==> prisma migrate deploy failed after $max_attempts attempts, giving up"
    exit 1
  fi
  echo "==> prisma migrate deploy failed (attempt $attempt/$max_attempts), retrying in 3s..."
  attempt=$((attempt + 1))
  sleep 3
done

echo "==> Starting server"
exec node server.js
