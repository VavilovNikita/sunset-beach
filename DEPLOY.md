# Deploying to Ubuntu VPS (Docker + DuckDNS)

Target: `prostak59.duckdns.org`, already pointed at the VPS via DuckDNS DNS.
Docker is already installed on the server. Nginx runs **on the host** (not in
a container) and path-routes one domain to sunset-beach and sunset, two of
three independent `docker compose` projects on this same VPS (the third
being the shared Postgres project both of them connect to — see below):

- **sunset-beach** (this repo) — the Next.js frontend, on `127.0.0.1:3000`.
  Owns the database *schema* (Prisma migrations) and the one remaining
  server-side concern here: NextAuth login against the `User` table. It does
  **not** run the Postgres container itself — see "Postgres is a shared
  resource" below.
- **sunset** (`github.com/VavilovNikita/sunset`, cloned separately) — the
  Spring Boot API, on `127.0.0.1:8080`, proxied at `/api/*` on the same
  domain. Reads/writes every other table (rooms, pricing, availability,
  bookings, staff users) against the *same* Postgres instance, and decrypts
  the same `next-auth.session-token` cookie to authenticate staff requests.

### Postgres is a shared resource, not owned by either project

Postgres is its own, third `docker compose` project on this VPS — brought up
from this repo's plain `docker-compose.yml` (the same file used for local
dev), deployed standalone. **Neither `docker-compose.prod.yml` (sunset-beach)
nor sunset's own compose file define a `db` service** — both connect to this
project's Postgres container as clients, joining its Docker network
(`sunset-beach_default` by default) rather than creating their own.

This matters operationally: `docker compose -f docker-compose.prod.yml down`
only ever touches what that file defines (`app`, `seed`) — it cannot
accidentally stop or remove the shared Postgres container, because that
container isn't part of this compose project. Bring the Postgres project up
and down independently, from its own directory, with its own `docker compose
-f docker-compose.yml ...` commands.

It also means `app` has no compose-level `depends_on`/healthcheck wait on
`db` (Compose can't express that across separate projects) — `docker-entrypoint.sh`
retries `prisma migrate deploy` for about 30s on startup to ride out the case
where this container comes up before Postgres does, e.g. after a host reboot.

Because both are proxied under one public origin, the browser sees them as
same-origin — no CORS and no cross-subdomain cookie configuration needed for
this topology (see `AUTH_COOKIE_DOMAIN` in `.env.production.example`, which
stays empty here).

**Deploy sunset-beach first** — sunset's Hibernate validates the schema on
startup (`ddl-auto=validate`) and will fail to start if the tables it expects
don't exist yet. sunset-beach's Prisma migrations are what create them.

## 0. One-time host setup

```bash
# Nginx + certbot (Ubuntu)
sudo apt update
sudo apt install -y nginx certbot

# Firewall: only SSH, HTTP, HTTPS from the internet
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Docker Compose v2 plugin, if not already present
docker compose version || sudo apt install -y docker-compose-plugin
```

## 1. Get the code onto the server

```bash
git clone <sunset-beach-repo-url> /opt/sunset-beach
cd /opt/sunset-beach
```

(Or `rsync`/`scp` the project directory if it's not in a git remote yet.)

## 2. Configure environment

```bash
cp .env.production.example .env.production
nano .env.production
```

Fill in real values:
- `DATABASE_URL` — user/password/db name must match whatever the shared
  Postgres project (see "Postgres is a shared resource" above) was actually
  started with; this file no longer controls Postgres's own credentials.
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`. **Copy this
  value** — sunset's own `.env` needs the byte-for-byte same secret in step 8.
- `NEXTAUTH_URL` — already set to `https://prostak59.duckdns.org`, leave as is.
- `BACKEND_API_URL` — set based on how sunset is actually deployed relative
  to this container; see the detailed comment in `.env.production.example`
  (container-name + internal port if sunset shares the Docker network,
  `host.docker.internal` + published port otherwise). There is no default
  bundled with this file that's guaranteed correct — pick the one that
  matches step 8.
- `NEXT_PUBLIC_BACKEND_API_URL` — already set correctly for this
  single-domain setup; only change it if sunset ends up on a different
  host/domain. **Changing it later requires rebuilding the image with
  `--build-arg` (see the `Dockerfile` / `docker-compose.prod.yml` comments) —
  a plain restart won't pick it up.**
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — the first admin login (change
  the password after first login). `SEED_ADMIN_PASSWORD` is required; the
  seed script now refuses to run without it rather than falling back to a
  guessable default.

`.env.production` is gitignored — never commit it.

Also create a **compose-level** `.env` file (a different, unrelated
mechanism — this one is read automatically by `docker compose` itself for
`${...}` substitution in `docker-compose.prod.yml`, not by the app):

```bash
echo 'NEXT_PUBLIC_BACKEND_API_URL=https://prostak59.duckdns.org/api' > .env
```

This is required because `NEXT_PUBLIC_*` values are inlined into the client
JS bundle at `next build` time — `.env.production` alone (only wired up at
container *start*) can't reach that build step.

If the shared Postgres project's network isn't named `sunset-beach_default`
(Compose's default for a checkout of its `docker-compose.yml` with no
explicit `name:`), also add `DB_NETWORK_NAME=<actual-network-name>` to this
same compose-level `.env` file — `docker-compose.prod.yml` treats that
network as external and will fail to start if it doesn't already exist under
that name.

## 3. Issue a TLS certificate (webroot method)

The app isn't running yet, so certbot needs somewhere on disk to drop the
ACME HTTP-01 challenge and a plain HTTP nginx block to serve it — this
matches the `/.well-known/acme-challenge/` location already in
`nginx/conf.d/app.conf`.

```bash
sudo mkdir -p /var/www/certbot

# Temporary HTTP-only server block, just for the initial challenge
sudo tee /etc/nginx/conf.d/app.conf > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name prostak59.duckdns.org;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 "ok";
    }
}
EOF

sudo nginx -t && sudo systemctl reload nginx

sudo certbot certonly --webroot -w /var/www/certbot \
  -d prostak59.duckdns.org \
  --email you@example.com --agree-tos --no-eff-email
```

This creates `/etc/letsencrypt/live/prostak59.duckdns.org/{fullchain,privkey}.pem`.

## 4. Install the real nginx config

```bash
sudo cp nginx/conf.d/app.conf /etc/nginx/conf.d/app.conf
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` will only pass once the certs from step 3 exist, since the file
references them directly. This config already proxies both `/` (Next.js, port
3000) and `/api/` (sunset, port 8080) — sunset doesn't need to be running yet
for this reload to succeed, its location just won't resolve to anything until
step 8.

## 5. Start the shared Postgres project (if not already running)

```bash
git clone <sunset-beach-repo-url> /opt/sunset-beach-db  # or reuse /opt/sunset-beach's checkout
cd /opt/sunset-beach-db
docker compose up -d
```

This is the plain `docker-compose.yml` (same one used for local dev) —
independent of everything below, and typically only needs to be started once
per VPS. It creates the `sunset-beach_default` network that both
sunset-beach's `app`/`seed` and sunset itself connect to as clients.
Production credentials for this container are whatever `docker-compose.yml`
and its environment resolve to on this host — **not** anything in
sunset-beach's `.env.production`, which no longer configures Postgres itself
(see "Postgres is a shared resource" above).

## 6. Build and start sunset-beach

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f app
```

The `app` container's entrypoint runs `prisma migrate deploy` automatically
against `db` before starting the server, so the schema is applied on every
deploy — this is what sunset's schema validation depends on in the next
step. `db` here resolves via the shared `sunset-beach_default` Docker
network from step 5, not a container this compose file owns.

Check it's up: `https://prostak59.duckdns.org` should load over HTTPS (the
public rooms/booking pages won't have real data until sunset is running too —
that's expected at this point).

## 7. Seed the initial admin account (first deploy only)

The production image is intentionally slim and doesn't ship `tsx`/dev
dependencies, so seeding uses the `seed` helper service (compose `profiles`
keep it from starting with regular `up`), which builds from the `builder`
stage and runs against the shared `db` container over the external network:

```bash
docker compose -f docker-compose.prod.yml run --rm seed
```

This is idempotent (`upsert`-based) — safe to re-run, but you only need it
once to create the admin login and seed rooms. It fails fast with a clear
error if `SEED_ADMIN_PASSWORD` isn't set in `.env.production`, rather than
silently seeding a guessable default password.

## 8. Deploy sunset (Spring Boot) alongside it

```bash
git clone https://github.com/VavilovNikita/sunset.git /opt/sunset
cd /opt/sunset
cp .env.example .env  # or create it if sunset has none yet — see its own README
nano .env
```

Fill in:
- `DATABASE_URL` — point it at the same shared Postgres from step 5. If
  sunset's own `docker-compose.yml` joins the `sunset-beach_default` network
  too (check/add a `networks: default: name: sunset-beach_default: external:
  true` block there, matching `docker-compose.prod.yml`), use the container
  name: `jdbc:postgresql://db:5432/sunsetbeach`. Only fall back to
  `jdbc:postgresql://host.docker.internal:5432/sunsetbeach` if sunset stays
  off that network and Postgres is published to the host loopback instead —
  confirm the shared project actually publishes that port before relying on
  it.
- `DATABASE_USER` / `DATABASE_PASSWORD` — must match whatever the shared
  Postgres project (step 5) was actually started with, the same values used
  in sunset-beach's own `DATABASE_URL` (step 2).
- `NEXTAUTH_SECRET` — **byte-for-byte identical** to the one in
  sunset-beach's `.env.production` (step 2). If these don't match, sunset
  can't decrypt the session cookie and every staff request 401s.
- `CORS_ALLOWED_ORIGINS` — not load-bearing for this same-domain, path-routed
  setup (the browser never makes a cross-origin request), but harmless to
  set to `https://prostak59.duckdns.org` anyway as defense in depth.
- `UPLOADS_ROOT` — leave as its default (a Docker volume, per sunset's own
  `docker-compose.yml`); this is where staff-uploaded room photos live.

```bash
docker compose build
docker compose up -d
docker compose logs -f backend
```

Check it: `curl -s https://prostak59.duckdns.org/api/actuator/health` should
return `{"status":"UP"}`. Then load `https://prostak59.duckdns.org/rooms` (or
`/admin` after logging in) — this is when the site actually starts showing
live room/pricing/booking data, since that all now comes from sunset.
Once sunset is confirmed reachable this way, go back and set
sunset-beach's `BACKEND_API_URL` (step 2) to match however you just
configured this container's networking — container-name-based if you added
it to the shared network, `host.docker.internal` otherwise — and redeploy
`app` (see "Redeploying after code changes" below) so server-side fetches
use it.

## 9. Auto-renew the certificate

Ubuntu's certbot package installs a systemd timer that renews automatically.
Add a hook so nginx reloads after renewal:

```bash
echo -e '#!/bin/sh\nsystemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run
```

## Redeploying after code changes

sunset-beach:
```bash
cd /opt/sunset-beach
git pull
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
```

This only touches the `app` container — Postgres lives in a separate compose
project (step 5) and is never affected by anything run here. Migrations run
again automatically on start (`prisma migrate deploy` is a no-op if there's
nothing new to apply).

sunset:
```bash
cd /opt/sunset
git pull
docker compose build
docker compose up -d
```

If sunset-beach's Prisma schema changed in this deploy, redeploy sunset-beach
(migrations) *before* sunset, for the same startup-validation reason as the
initial deploy.

## Backups

Data lives in Docker volumes across three projects — at minimum, back up the
database regularly (it holds everything: users, rooms, bookings, etc.). Run
this from wherever the shared Postgres project (step 5) actually lives, not
from `/opt/sunset-beach` — `docker-compose.prod.yml` has no `db` service to
`exec` into:

```bash
docker compose -f /opt/sunset-beach-db/docker-compose.yml exec db \
  pg_dump -U sunsetbeach sunsetbeach | gzip > backup-$(date +%F).sql.gz
```

Also back up sunset's `uploads` named volume (staff-uploaded room photos) —
see that repo's own docs for the exact volume name.

## Troubleshooting

- **502 from nginx on `/`**: sunset-beach's `app` container isn't up yet or
  crashed — check `docker compose -f docker-compose.prod.yml logs app`.
- **502 from nginx on `/api/`**: sunset's `backend` container isn't up yet or
  crashed — check `docker compose logs backend` in `/opt/sunset`, and confirm
  it's actually publishing `127.0.0.1:8080`.
- **sunset fails to start with a schema validation error**: sunset-beach's
  migrations haven't run yet, or sunset's `DATABASE_URL` points at a
  different database than sunset-beach's — re-check step 8's `DATABASE_URL`/
  `DATABASE_USER`/`DATABASE_PASSWORD` against sunset-beach's
  `.env.production` and against what the shared Postgres project (step 5)
  was actually started with.
- **Admin pages 401 even after logging in**: `NEXTAUTH_SECRET` in
  `/opt/sunset/.env` doesn't byte-for-byte match sunset-beach's
  `.env.production` — sunset can't decrypt the cookie NextAuth issued.
- **`app` or `seed` fails to start with a "network not found" error**: the
  shared Postgres project (step 5) either isn't running yet, or its network
  isn't actually named `sunset-beach_default` — check with `docker network
  ls`, and set `DB_NETWORK_NAME` in the compose-level `.env` file (step 2) if
  it differs.
- **Migration errors on start (sunset-beach)**: check `DATABASE_URL` in
  `.env.production` matches whatever `POSTGRES_USER`/`POSTGRES_PASSWORD`/
  `POSTGRES_DB` the shared Postgres project (step 5) was actually started
  with.
- **`sunset-beach's app can't reach sunset (Java)`**: re-check
  `BACKEND_API_URL` in `.env.production` against however sunset is actually
  networked (step 8) — container-name+internal-port if it's on the shared
  Docker network, `host.docker.internal`+published-port only if it isn't.
  There's no default here that's correct for every topology.
- **NextAuth redirect/cookie issues behind the proxy**: confirm
  `NEXTAUTH_URL` is the `https://` URL and that nginx is sending
  `X-Forwarded-Proto`/`X-Forwarded-For` (already set in `nginx/conf.d/app.conf`).
- **Room images 404**: confirm `NEXT_PUBLIC_BACKEND_API_URL` was actually
  present (compose-level `.env`, step 2) when sunset-beach's image was last
  built — it's baked in at build time, so changing it requires a rebuild
  (`docker compose -f docker-compose.prod.yml build app`), not just a restart.
