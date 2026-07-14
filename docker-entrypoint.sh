#!/bin/sh
set -e

echo "==> Running prisma migrate deploy"
node node_modules/prisma/build/index.js migrate deploy

echo "==> Starting server"
exec node server.js
