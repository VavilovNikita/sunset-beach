# Deploying to Ubuntu VPS (Docker + DuckDNS)

Target: `prostak59.duckdns.org`, already pointed at the VPS via DuckDNS DNS.
Docker is already installed on the server. Nginx runs **on the host** (not in
a container) and path-routes one domain to two independent `docker compose`
projects on this same VPS:

- **sunset-beach** (this repo) — the Next.js frontend + Postgres, on
  `127.0.0.1:3000`. Owns the database (Prisma migrations) and the one
  remaining server-side concern here: NextAuth login against the `User`
  table.
- **sunset** (`github.com/VavilovNikita/sunset`, cloned separately) — the
  Spring Boot API, on `127.0.0.1:8080`, proxied at `/api/*` on the same
  domain. Reads/writes every other table (rooms, pricing, availability,
  bookings, staff users) against the *same* Postgres instance, and decrypts
  the same `next-auth.session-token` cookie to authenticate staff requests.

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
- `POSTGRES_PASSWORD` — a strong random password (must match the one in `DATABASE_URL`).
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`. **Copy this
  value** — sunset's own `.env` needs the byte-for-byte same secret in step 6.
- `NEXTAUTH_URL` — already set to `https://prostak59.duckdns.org`, leave as is.
- `BACKEND_API_URL` / `NEXT_PUBLIC_BACKEND_API_URL` — already set correctly
  for this single-domain setup; only change them if sunset ends up on a
  different host/domain.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — the first admin login (change the password after first login).

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
step 6.

## 5. Build and start sunset-beach

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f app
```

The `app` container's entrypoint runs `prisma migrate deploy` automatically
against `db` before starting the server, so the schema is applied on every
deploy — this is what sunset's schema validation depends on in step 6. `db`
is published to `127.0.0.1:5432` (loopback only, not the internet) so sunset,
a separate compose project on this same VPS, can reach it.

Check it's up: `https://prostak59.duckdns.org` should load over HTTPS (the
public rooms/booking pages won't have real data until sunset is running too —
that's expected at this point).

## 6. Seed the initial admin account (first deploy only)

The production image is intentionally slim and doesn't ship `tsx`/dev
dependencies, so seeding uses the `seed` helper service (compose `profiles`
keep it from starting with regular `up`), which builds from the `builder`
stage and runs against the same `db` container over the internal network:

```bash
docker compose -f docker-compose.prod.yml run --rm seed
```

This is idempotent (`upsert`-based) — safe to re-run, but you only need it
once to create the admin login and seed rooms.

## 7. Deploy sunset (Spring Boot) alongside it

```bash
git clone https://github.com/VavilovNikita/sunset.git /opt/sunset
cd /opt/sunset
cp .env.example .env  # or create it if sunset has none yet — see its own README
nano .env
```

Fill in:
- `DATABASE_URL=jdbc:postgresql://host.docker.internal:5432/sunsetbeach`
  (reaches sunset-beach's `db` container via the loopback port published in
  step 5 — `host.docker.internal` is already mapped by sunset's own
  `docker-compose.yml`).
- `DATABASE_USER` / `DATABASE_PASSWORD` — must match `POSTGRES_USER` /
  `POSTGRES_PASSWORD` from sunset-beach's `.env.production`.
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

## 8. Auto-renew the certificate

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

`db` and its data volume are untouched by this — only the `app` container is
rebuilt and replaced. Migrations run again automatically on start (`prisma
migrate deploy` is a no-op if there's nothing new to apply).

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

Data lives in Docker volumes across both projects — at minimum, back up the
database regularly (it holds everything: users, rooms, bookings, etc.):

```bash
docker compose -f /opt/sunset-beach/docker-compose.prod.yml exec db \
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
  migrations haven't run yet, or ran against a different database than
  sunset's `DATABASE_URL` points at — re-check step 7's `DATABASE_URL`/
  `DATABASE_USER`/`DATABASE_PASSWORD` against sunset-beach's `.env.production`.
- **Admin pages 401 even after logging in**: `NEXTAUTH_SECRET` in
  `/opt/sunset/.env` doesn't byte-for-byte match sunset-beach's
  `.env.production` — sunset can't decrypt the cookie NextAuth issued.
- **Migration errors on start (sunset-beach)**: check `DATABASE_URL` in
  `.env.production` matches `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`,
  and that `db` passed its healthcheck (`docker compose -f
  docker-compose.prod.yml ps`).
- **NextAuth redirect/cookie issues behind the proxy**: confirm
  `NEXTAUTH_URL` is the `https://` URL and that nginx is sending
  `X-Forwarded-Proto`/`X-Forwarded-For` (already set in `nginx/conf.d/app.conf`).
- **Room images 404**: confirm `NEXT_PUBLIC_BACKEND_API_URL` was actually
  present (compose-level `.env`, step 2) when sunset-beach's image was last
  built — it's baked in at build time, so changing it requires a rebuild
  (`docker compose -f docker-compose.prod.yml build app`), not just a restart.
