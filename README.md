# The Sunset Beach Resort & Spa — modern rebuild

A from-scratch Next.js 14 (App Router) + TypeScript + Tailwind rebuild of the
CodeIgniter site found in `application.zip`. Content and copy are carried over
from the original PHP views; the visual design, components and code are new.

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
