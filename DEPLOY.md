# Deploying to Ubuntu VPS (Docker + DuckDNS)

Target: `prostak59.duckdns.org`, already pointed at the VPS via DuckDNS DNS.
Docker is already installed on the server. Nginx runs **on the host** (not in
a container) and reverse-proxies to the app container on `127.0.0.1:3000`.

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
git clone <your-repo-url> /opt/sunset-beach
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
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
- `NEXTAUTH_URL` — already set to `https://prostak59.duckdns.org`, leave as is.
- `RESEND_API_KEY` / `EMAIL_FROM` — your Resend credentials.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — the first admin login (change the password after first login).

`.env.production` is gitignored — never commit it.

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
references them directly.

## 5. Build and start the app

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f app
```

The `app` container's entrypoint runs `prisma migrate deploy` automatically
against `db` before starting the server, so the schema is applied on every
deploy. `db` has no published port — it's reachable only from `app` on the
internal `sunset-beach-internal` Docker network.

Check it's up: `https://prostak59.duckdns.org` should load over HTTPS.

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

## 7. Auto-renew the certificate

Ubuntu's certbot package installs a systemd timer that renews automatically.
Add a hook so nginx reloads after renewal:

```bash
echo -e '#!/bin/sh\nsystemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run
```

## Redeploying after code changes

```bash
cd /opt/sunset-beach
git pull
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
```

`db` and its data volume, plus the `public/uploads` volume, are untouched by
this — only the `app` container is rebuilt and replaced. Migrations run
again automatically on start (`prisma migrate deploy` is a no-op if there's
nothing new to apply).

## Backups

Data lives in two named Docker volumes: `sunset-beach_db-data` (Postgres) and
`sunset-beach_uploads-data` (room images). At minimum, back up the database
regularly:

```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U sunsetbeach sunsetbeach | gzip > backup-$(date +%F).sql.gz
```

## Troubleshooting

- **502 from nginx**: the app container isn't up yet or crashed — check
  `docker compose -f docker-compose.prod.yml logs app`.
- **Migration errors on start**: check `DATABASE_URL` in `.env.production`
  matches `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, and that `db`
  passed its healthcheck (`docker compose -f docker-compose.prod.yml ps`).
- **NextAuth redirect/cookie issues behind the proxy**: confirm
  `NEXTAUTH_URL` is the `https://` URL and that nginx is sending
  `X-Forwarded-Proto`/`X-Forwarded-For` (already set in `nginx/conf.d/app.conf`).
