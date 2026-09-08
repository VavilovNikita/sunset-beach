# CLAUDE.md — sunset-beach (frontend)

Public hotel website plus two staff interfaces: an office admin (`/admin`, desktop) and a floor POS (`/pos`, phone). Next.js 14 App Router, TypeScript, Tailwind. Talks to the `sunset` backend.

Rules below were learned from real bugs. Where one looks arbitrary, the reason is stated.

---

## Deliberately absent dependencies

No state manager. No date library. No drag-and-drop library. No UI kit. These are choices, not gaps — do not add one without asking.

Data comes from `fetch` in Server Components and `useState` in client ones. Drag interactions use native Pointer Events; `BookingCalendarGrid` and the property map are the reference implementations, and both work on tablets.

## The API contract lives in the other repository

Types in `lib/types.ts` and `lib/posTypes.ts` mirror the backend's `openapi.yaml` **by hand**. There is no generated client.

**Read the real spec before writing a type or a call.** Run sessions with the backend repository accessible. Guessing endpoint shapes has produced silent 404s and a whole round of wrong work; when the spec is not readable, say so instead of inferring.

## Dates

**Never parse a stay date by hand.** Use the helpers in `lib/bookings.ts` (`dateOnlyUTC`, `addDaysUTC`, `toDateKey`, `getNights`). A hand-rolled parse once returned an invalid date silently, which made every comparison false and left the dashboard reporting zero revenue and zero occupancy for months.

Do not add a date library. Local-time parsing shifts date-only values by a day in this timezone, which is exactly what the helpers exist to prevent.

## Money

**Never display an amount computed on the client.** Prices, totals and balances come from the server, including previews: an operation that changes a price shows the server's recalculated figure before the user confirms.

Gate on amounts, not counts. A count of past charges never returns to zero, so a badge keyed on it stays lit forever — this exact bug appeared in three places.

## Requests and failures

Authorized calls go through the same-origin proxy (`/api/admin-proxy/...`). The public site uses `/api/public-proxy/...`, which has a strict allowlist — it is unauthenticated, so it must never forward arbitrary paths to the backend.

Use `adminRequest` / `posRequest`. They distinguish a connection failure from a server rejection and surface the backend's own message.

**Never swallow a failure into a plausible-looking empty state.** A failed load once rendered as "no bookings found for today", which a cashier would read as "no guests". Say what happened.

**Secondary data must not take the page down.** A failing side request (a badge, a summary) degrades on its own; the main screen keeps working. A print-queue badge once crashed the entire orders screen.

Any action that can fail shows its failure next to the control that triggered it, and returns that control to a usable state.

## Roles

`hasRoleAtLeast` and the `requireRoleAtLeast` guards. Hierarchy: `ADMIN > MANAGER > CASHIER > WAITER`.

Hide actions a role cannot perform — do not show a working form that fails on save. Guard the page itself too, not only the link: a hidden link is not access control.

Landing after sign-in depends on role. Nav grouping and visibility live in `lib/adminNav.ts` — `NAV_GROUPS` data plus `isNavLinkVisible`/`visibleNavGroups`, both pure and tested in `adminNav.test.ts` (including "no group ever renders empty"); keep new links there rather than scattering role checks through JSX.

## Colour meanings

Established across all screens; do not repurpose. Named by their Tailwind class, since that's what's greppable — `sea`/`coral`/`sand`/`ink`/`cream` etc. are custom tokens defined in `tailwind.config.ts`; `amber-400`/`green-600`/`slate-600` are stock Tailwind colours used directly and won't show up in that file:

- **`sea`** — free / available
- **`coral`** — needs intervention (oversold, overlapping bookings, blocked room)
- **`sand`** — not cleaned
- **`amber-400`** — attention, not urgent (outstanding balance, room not assigned)
- **`green-600`** — paid
- **`slate-600`** — confirmed booking, the ordinary expected state
- neutral (`ink2`/`cream/10`) — occupied without a problem

The palette is full. Distinguish new states by shape, hatching or an icon rather than a new colour. Known remaining ambiguity: `sea` also colours the `NEW` booking status, which is not "free" — left as is deliberately.

## Testing

Vitest, pure functions only — there are no DOM tests. Anything in `lib/` that computes a number, a date or a display decision should be tested, because a wrong result there is invisible on screen.

Extract logic out of fetch-bound functions so it can be tested; `computeRoomStats` (`lib/adminStats.ts`) and `resolveUnitDisplay` (`lib/propertyMapDisplay.ts`) are the pattern.

`npm run check` runs typecheck and tests together.

**Do not run `next build` while the dev server is running.** Both write to `.next` and corrupt each other, producing module-not-found errors that look like code bugs.

Components are not covered by tests. Restructuring them is verified in the browser or not at all — say so when a change needs a live check you cannot perform.

## Two POS surfaces

`/admin/pos` (desktop, supervised machine) and `/pos` (phone, passed between staff) are separate component trees on purpose. Differences that exist deliberately are commented at the call sites: identity confirmation before money actions and idle logout exist only on the phone, because that device changes hands.

When changing behaviour in one, check whether the other needs it too — they have drifted before.

## Public site

Guest-facing pages and the booking flow are not to be touched unless the task is about them. They are the only part real guests see, and they are the least covered by tests.

## Working style

When a decision is a judgment call — a data model, a permission boundary, anything touching money — present the options and a recommendation and wait, rather than choosing silently.

The staff manual quotes UI labels verbatim. Renaming a visible label breaks it; propose rather than rename.