# The Sunset Beach Resort & Spa — modern rebuild

A from-scratch Next.js 14 (App Router) + TypeScript + Tailwind rebuild of the
CodeIgniter site found in `application.zip`. Content and copy are carried over
from the original PHP views; the visual design, components and code are new.

## Architecture: this repo vs. `sunset`

This repo is now mostly a frontend. The only server-side logic left here is a
thin auth layer:
- `app/api/auth/[...nextauth]/route.ts` + `lib/auth.ts` — NextAuth
  (`Credentials` provider) checks `email`/`password` against the `User` table
  via Prisma and issues the `next-auth.session-token` session cookie (JWE,
  NextAuth v4 `dir`/`A256GCM`).
- `prisma/schema.prisma` + migrations — still owned here. `npx prisma migrate
  dev` is the only way the schema changes; the Java side runs with
  `ddl-auto=validate` and never writes DDL.

Everything else — rooms, pricing, availability, bookings, staff user
management, room image uploads/serving, and outgoing email — lives in the
sibling `sunset` (Spring Boot) repo, which reads/writes the same Postgres
database and decrypts the same session cookie (via `nimbus-jose-jwt`) to know
who's logged in. Every page that used to read Prisma directly in a Server
Component now calls that API instead — see `lib/backend.ts` /
`lib/backendServer.ts` for the fetch helpers, and `lib/publicQuote.ts` /
`lib/adminStats.ts` for the two spots (guest availability+pricing quotes, the
admin dashboard's stats) that assemble data client-side from a couple of
Java endpoints because there's no single endpoint that returns it directly.

### Running both services locally

1. Start Postgres: `docker compose up -d` (this repo's `docker-compose.yml`).
2. Run this repo: `npm install && npm run dev` (http://localhost:3000).
3. Run `sunset` separately (`./mvnw spring-boot:run`, or however that repo's
   README says to start it) against the same `DATABASE_URL`, listening on
   `http://localhost:8080` with `server.servlet.context-path=/api`.
4. Make sure `NEXTAUTH_SECRET` is byte-for-byte identical in both `.env`
   files — that's what lets the Java side decrypt the session cookie this
   repo issues.

### Where the frontend gets `BACKEND_API_URL`

Two env vars, both pointing at the Java API (see `.env.example`):
- `BACKEND_API_URL` — used by Server Components for server-to-server calls;
  can be an internal/Docker-only hostname.
- `NEXT_PUBLIC_BACKEND_API_URL` — used by Client Components and anywhere a
  URL is rendered into HTML (e.g. room image `<img src>`); must always be
  reachable by the browser. Because Next.js inlines `NEXT_PUBLIC_*` values at
  `next build` time, in the Docker build this one has to be passed as a
  build-arg, not just set at container start — see the comments in
  `Dockerfile` and `docker-compose.prod.yml`.

In production, if the frontend and the Java API are deployed on different
subdomains of the same parent domain (e.g. `www.example.com` /
`api.example.com`), also set `AUTH_COOKIE_DOMAIN` (e.g. `.example.com`) so
the session cookie is sent cross-subdomain — see the comment in `lib/auth.ts`.
The Java side needs a matching CORS allow-list (`CORS_ALLOWED_ORIGINS` there)
for the frontend's origin.

## What's here
- `/` — Home
- `/rooms` — Rooms & Villas (was `accommodations`)
- `/restaurant` — L'Ananas Restaurant & Bar
- `/spa` — Spa
- `/weddings` — Weddings & Events
- `/contact` — Contact (with a client-side form ready to wire to your own backend)
- `/about`, `/koh-samui`, `/terms`, `/privacy` — supporting pages

## Design notes
- Palette: deep ink-teal (`#0F262B`) as the dominant tone, with a sunset coral
  accent (`#E2612F`) and warm sand for card surfaces — a deliberate flip of the
  usual "cream + terracotta" template look, since a *secluded* sunset resort
  reads better dark and moody than bright and generic.
- Typography: Fraunces (display/italic) + Work Sans (body/UI).
- Signature element: the "horizon line" — a slow-drifting gradient divider and
  an SVG sunset scene in the hero — a literal callback to the resort's name.
- No photography was included in the original zip (only PHP templates), so
  room/spa/restaurant imagery is represented with gradient "ArtBlock"
  placeholders (`components/ArtBlock.tsx`). Swap these for real photos before
  launch — just replace the component usage with `<Image src="..." />`.
- The booking bar posts to the same reservation portal URL used by the
  original site (`v4.reservation-system.net`) with the same hotel code.

## Getting started
```bash
npm install
npm run dev
```
Then open http://localhost:3000

## Before going live
- Replace `ArtBlock` placeholders with real photography (villas, spa, food).
- Wire `components/ContactForm.tsx` to a real email/CRM endpoint (an API route,
  Resend, Formspree, etc. — it currently only simulates sending).
- Fill in real copy for `/terms` and `/privacy`.
- Add a favicon and Open Graph image.
