# The Sunset Beach Resort & Spa — modern rebuild

A from-scratch Next.js 14 (App Router) + TypeScript + Tailwind rebuild of the
CodeIgniter site found in `application.zip`. Content and copy are carried over
from the original PHP views; the visual design, components and code are new.

## Architecture: this repo vs. `sunset`

This repo is a pure frontend / BFF — it has no database connection of its
own. The only server-side logic left here is a thin auth proxy:
- `app/api/session/login/route.ts` — exchanges `email`/`password` with
  sunset's `POST /auth/login`, then stores the JWT it returns in an httpOnly
  `session-token` cookie (never sent back to the client in the response
  body).
- `app/api/session/logout/route.ts` — clears that cookie.
- `app/api/session/register/route.ts` — checks the caller is an authenticated
  `ADMIN` (via sunset's `GET /auth/me`), then proxies to sunset's
  `POST /auth/register`.
- `middleware.ts` / `lib/rbac.ts` — protect `/admin/*` by validating the
  cookie against sunset's `GET /auth/me` on every request; there is no local
  JWT verification, sunset is the sole source of truth for session validity.
- `lib/backendServer.ts` — every other authenticated server-side fetch to
  sunset sends the cookie's token as `Authorization: Bearer <token>`.

Everything else — auth/users, rooms, pricing, availability, bookings, room
image uploads/serving, and outgoing email — lives entirely in the sibling
`sunset` (Spring Boot) repo, which owns the database (schema, migrations,
every table) and issues/validates its own JWTs. Every page that used to read
Prisma directly in a Server Component now calls that API instead — see
`lib/backend.ts` / `lib/backendServer.ts` for the fetch helpers, and
`lib/publicQuote.ts` / `lib/adminStats.ts` for the two spots (guest
availability+pricing quotes, the admin dashboard's stats) that assemble data
client-side from a couple of Java endpoints because there's no single
endpoint that returns it directly.

### Running both services locally

1. Run this repo: `npm install && npm run dev` (http://localhost:3000).
2. Run `sunset` separately (`./mvnw spring-boot:run`, or however that repo's
   README says to start it), listening on `http://localhost:8080` with
   `server.servlet.context-path=/api`, and with its own Postgres running
   (this repo's `docker-compose.yml` can still be used standalone for that,
   or use whatever sunset's own docs recommend).
3. Point this repo's `BACKEND_API_URL` / `NEXT_PUBLIC_BACKEND_API_URL` at
   that sunset instance (see `.env.example`).

### API contract

There is no `openapi.yaml` in this repo (one existed here historically,
describing the pre-rewrite Next.js/Prisma/NextAuth API — it was deleted
because it no longer matched anything and had already caused an agent to work
from the wrong schema). The real, current contract is `openapi.yaml` in the
`sunset` repo — that's the source of truth for every request/response shape
this frontend depends on.

`lib/types.ts` and `lib/posTypes.ts` hand-mirror that contract (rooms,
bookings, availability, pricing, users on the one hand; POS menu/tables/
orders/shifts/payments on the other). There is no codegen step tying them
together — **when `sunset`'s `openapi.yaml` changes, these two files have to
be updated by hand to match**, and it's worth grepping for the changed field
names across `components/`/`app/`/`lib/` afterward, since nothing here will
catch a drift automatically.

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
  **Changing this value later requires rebuilding the image with
  `--build-arg NEXT_PUBLIC_BACKEND_API_URL=...`; restarting the container
  with an updated `.env.production` alone will NOT pick up the change.**

The `session-token` cookie set by `app/api/session/login` is only ever read
by this Next.js app itself (to validate `/admin/*` requests and to attach it
as a `Bearer` token on server-side fetches to sunset) — it's never sent
directly to sunset by the browser, so no cross-subdomain cookie
configuration is needed even if the frontend and Java API end up on
different subdomains. The Java side still needs a CORS allow-list
(`CORS_ALLOWED_ORIGINS`) covering the frontend's origin, since the browser
does make same-origin-looking-but-technically-cross-origin requests to it
for public data (e.g. room images).

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
