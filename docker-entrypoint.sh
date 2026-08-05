#!/bin/sh
set -e

# Database schema/migrations are now owned entirely by the sunset (Java)
# repo — this app no longer touches the schema at startup.
echo "==> Starting server"
exec node server.js
