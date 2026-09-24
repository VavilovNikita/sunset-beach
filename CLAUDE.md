# CLAUDE.md — sunset-beach (frontend)

Public hotel website plus two staff interfaces: an office admin (`/admin`, desktop) and a floor POS (`/pos`, phone). Next.js 14 App Router, TypeScript, Tailwind. Talks to the `sunset` backend.

Rules below were learned from real bugs. Where one looks arbitrary, the reason is stated.

---

## Deliberately absent dependencies

No state manager. No date library. No drag-and-drop library. No UI kit. These are choices, not gaps — do not add one without asking.

Data comes from `fetch` in Server Components and `useState` in client ones. Drag interactions use native Pointer Events; `BookingCalendarGrid` and the property map are the reference implementations.

**A drag source needs `touch-none` as a static class, never set only from its own `pointerdown` handler.** A browser fixes a touch gesture's `touch-action` when the finger lands, before `pointerdown` runs — so `setTouchActionNone(true)` inside the handler is already too late: the first finger move pans instead and fires `pointercancel`, killing the drag. `BookingCalendarGrid`, `SpaScheduleGrid` and `RosterGrid` all shipped that way and could not be dragged by touch at all, despite this file once claiming the calendar "works on tablets" — found by a synthetic-touch test, not by reading the code. `PropertyMapView`'s tiles had it right. Put `touch-none` only on what's actually draggable (conditioned the same way the drag itself is: `canManage`, `allowDrag`, `status === "BOOKED"`, `!locked`), never on a grid's background cells, or the grid can no longer be scrolled by touch — which is why the calendar's drag-to-select-a-range stays mouse-only (a tap on a free cell still opens the create form).

The tap-to-open-on-touch / double-click-to-open-on-mouse gesture that has to coexist with a drag on a pointer-driven grid lives in `lib/useTapOrDoubleClick.ts` — `BookingCalendarGrid`, `SpaScheduleGrid`, and `SpaTableMapView` all use it. Extend that hook if another grid needs the same gesture; do not write a third inline version.

**`SpaScheduleGrid` deliberately does not carry two of `BookingCalendarGrid`'s gestures — edge-resize and drag-to-select-a-range — and the reason is the same for both.** A booking's length is a fact the calendar itself owns (`checkIn`/`checkOut`), so dragging an edge or dragging out a range are both legitimate ways to set it. A spa appointment's length is not a fact its own row owns — `durationMinutes` is a maintained sum of its treatments' own durations (see the backend's own CLAUDE.md, "Spa billing"). An edge-resize handle would be a second way to set that same number, and the two would disagree the moment anyone used it. Length changes by adding or removing a treatment, nowhere else — don't reintroduce either gesture to "restore parity" without reopening that design with whoever owns this module. A drag that picks a start time and narrows the treatment list to what fits before the next appointment is a real, different idea worth proposing on its own; it is not a resize or a range-select and hasn't been built.

**Anything layered over a grid must not receive pointer events while a drag is in progress, because the hit test looks through to what is underneath.** A drag's own `onDragPointerMove` finds the slot/bar under the pointer via `document.elementFromPoint(...).closest(...)` — that only ever finds the *topmost* element at that point, and pointer capture (set on the dragged element at `pointerdown`) still routes that element's own move/up events to it regardless of its own `pointer-events` value, so `pointer-events: none` on it costs nothing. Earned twice in one day, independently, which is what makes it a rule and not a one-off fix: the dragged appointment bar on `SpaScheduleGrid` kept `pointer-events-auto` while dragging, so hovering the bar's own last position made the hit test find the bar instead of the cell underneath, freezing/jumping the drag; hours later, making a `BookingCalendarGrid` block segment clickable (for its own double-click-to-inspect feature) removed *its* `pointer-events: none`, and a drag merely passing over a blocked date hit the block instead of seeing through to the cell or bar beneath it — the identical failure, reintroduced by an unrelated feature that had no idea a drag depended on that div staying transparent to it. Any new layer added on top of a grid (a status badge, a block, an annotation) needs the same toggle — `pointer-events: dragState ? "none" : "auto"` (or an equivalent condition scoped to "any drag is active," not just "this element is what's being dragged") — checked *before* it ships, not after a drag report traces back to it.

**Whether a drag needs a confirm-before-apply dialog is decided by the drag itself, not by making one grid match another.** A drag has an ambiguous drop point — the same release still has to be classified against whatever's underneath it, and on a grid that renders any optimistic position, something visibly moves on screen before a request has even been sent. A button inside an already-open panel has neither property: the user already picked the one thing it acts on by opening that panel, and nothing moves until the response comes back. That's the actual test — apply it to any new drag gesture on any grid, not "does the neighboring grid already do this." It is why `BookingCalendarGrid`'s move/resize/swap and `SpaScheduleGrid`'s move/swap all show a named dialog (who/what, from, to) before the PATCH/POST fires and apply only on confirm, while `SpaAppointmentPanel`'s complete/cancel/no-show/add-treatment/remove-treatment don't — none of those start from a drag. A swap's dialog names two people/guests because a swap moves two; a plain move or reassign still needs the same dialog shape for one, or for whichever second person the drop silently reassigns onto — the confirmation is earned by the drag, the content of the dialog just reflects who a specific drop actually touches.

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

**`COOKIE_SECURE` (`lib/session.ts`, shared by the staff and guest session cookies) must be `true` in production.** This site is HTTPS-only in production (nginx terminates TLS, port 80 only redirects) — `COOKIE_SECURE=false` was found still set in `.env.production` on the live server, dropping both session cookies without the `Secure` attribute. It's environment-specific, not a constant: keep it `false` for local plain-HTTP development, `true` wherever the site is actually served over HTTPS. Don't "fix" it back to `false` because an old comment or `.env.production.example` default says to — check how the site is actually being served first.

## Roles

`hasRoleAtLeast` and the `requireRoleAtLeast` guards. Hierarchy: `ADMIN > MANAGER > CASHIER > WAITER`.

Hide actions a role cannot perform — do not show a working form that fails on save. Guard the page itself too, not only the link: a hidden link is not access control.

Landing after sign-in depends on role. Nav grouping and visibility live in `lib/adminNav.ts` — `NAV_GROUPS` data plus `isNavLinkVisible`/`visibleNavGroups`, both pure and tested in `adminNav.test.ts` (including "no group ever renders empty"); keep new links there rather than scattering role checks through JSX.

**An audit log row's `actorRole` can be `null` — that means a system-initiated action (a scheduled sweep), not missing data.** The History page renders a `null` actorRole as "System" rather than blank or an error. See the backend's own CLAUDE.md, "Audit log", for what produces one.

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

**Scoped exception: shift-code chips.** `ShiftCode.displayColor` (`RosterGrid.tsx`, `ShiftCodeManager.tsx`) is an admin-chosen, per-code colour — the one deliberate departure from "no new colour" in this app. The roster grid's chips are a closed, small legend (a couple dozen codes at most) that accountants and staff already read off a paper schedule by real colour, not by a narrow lightness ramp — the fixed palette above has no room to give each code its own distinguishable hue, and forcing one through it would defeat the reason this exception exists. This does not reopen the rule anywhere else: every other screen in this app still picks from the fixed palette above, unchanged.

`chipAppearanceFor` (`lib/rosterGrid.ts`, shared by `RosterGrid.tsx` and `TodayShiftBoard.tsx`) now does the opposite of what this section used to say: where an admin has set a `displayColor`, every `kind` renders as a plain solid fill in that colour, full stop — no border, hatch, or glyph, regardless of what `kind` is. The old per-`kind` shape cues (neutral time-based shading for MORNING/EVENING, two-tone diagonal hatch for SPLIT, transparent+border for OPEN_SCHEDULE, transparent+dashed-border+"–"-glyph for ABSENCE) only apply when no `displayColor` is set at all. This was a deliberate simplification — the fill/hatch/outline/hollow system was found unreadable in practice — not a partial state to "finish"; don't reintroduce shape distinctions under a set colour without raising it as its own design question first.

**`RosterExportService#chipCellStyle` (Java, Excel export) is a second, independent implementation of this same visual scheme and needs to be checked against this file whenever one changes** — there is no shared code between them. As of the last check, `chipCellStyle` still has the *old* per-`kind` styling and has not been updated to match this simplification; confirm its current state before assuming it's in sync.

## Testing

Vitest, pure functions only — there are no DOM tests. Anything in `lib/` that computes a number, a date or a display decision should be tested, because a wrong result there is invisible on screen.

Extract logic out of fetch-bound functions so it can be tested; `computeRoomStats` (`lib/adminStats.ts`) and `resolveUnitDisplay` (`lib/propertyMapDisplay.ts`) are the pattern.

`npm run check` runs typecheck and tests together.

**Do not run `next build` while the dev server is running.** Both write to `.next` and corrupt each other, producing module-not-found errors that look like code bugs.

Components are not covered by tests. Restructuring them is verified in the browser or not at all — say so when a change needs a live check you cannot perform.

## Two POS surfaces

`/admin/pos` (desktop, supervised machine) and `/pos` (phone, passed between staff) are separate component trees on purpose. Differences that exist deliberately are commented at the call sites: identity confirmation before money actions and idle logout exist only on the phone, because that device changes hands.

When changing behaviour in one, check whether the other needs it too — they have drifted before.

## Spa

Spa tables are ordinary POS `Table` rows (`zone: "SPA"`), and a spa appointment occupies the same `Table`/therapist model the restaurant floor uses — the data is shared. The *screens* are still deliberately separate: `OrderBoard`/`PosTableBoard` (the restaurant floor views) explicitly exclude SPA-zone tables, and the spa module gets its own schedule grid (`/admin/spa`, `SpaScheduleGrid.tsx`, built around treatment/therapist/time-slot booking rather than walk-up table service) and its own table/map screens (`/admin/spa/tables`, `/admin/spa/map`). Reception works a spa appointment by treatment and time, not by walking up to a table — that's the whole reason for the split; don't read it as the data being separate too.

**The billing door's guest link is a pre-fill, not a query.** `billSpaAppointment` (`lib/spaOrderClient.ts`) sends the appointment's own `bookingId` when opening the order, so reception never re-looks-up a guest already on screen — the same "don't make reception retype what the screen already knows" reasoning as the guest picker's seeded search. It's a convenience only: it doesn't make that order the one that bills the treatment (that's `spaAppointmentId`, the explicit, deterministic link — see `SpaAppointmentPanel.tsx`) and it doesn't make the order authoritative for what a booking was charged (that's `Payment.bookingId`, set server-side at close — see the backend's own CLAUDE.md, "Spa billing").

**The unbilled-treatment warning is a server-computed field, not a client check.** An appointment now holds `treatments[]` (one row per treatment, see `SpaAppointmentTreatment` in `lib/posTypes.ts`) plus `missingTreatmentNames` — which of those the linked order doesn't (yet) carry, meaningful only once `status` is `COMPLETED`. `SpaAppointmentPanel.tsx` reads that field directly (`missingTreatmentNames.length > 0`); the grid's own ⚠ (`SpaScheduleGrid.tsx`) reads the same field, not `status`/`orderId` directly — the completeness question genuinely needs the linked order's own contents (which the grid never fetches), so it has to be computed server-side. See the backend's own CLAUDE.md, "Spa billing", for how it's computed and why a `CANCELLED` linked order counts as carrying nothing.

**A treatment's price is never frozen, so it's never stored on the appointment beyond a live figure.** `SpaAppointmentTreatment.currentPrice` is a live `MenuItem.price` read at response time — shown next to each treatment (`SpaAppointmentCreateModal.tsx`'s picker, `SpaAppointmentPanel.tsx`'s treatment list) purely for reception's reference, same "denormalized, not frozen" footing as `treatmentName`. The panel's "Estimated total" (`lib/spaTreatmentPricing.ts#sumTreatmentPrices`) sums those already-server-supplied numbers for a glance figure — it is never sent anywhere and never the number actually charged; that's computed fresh, live, by the ordinary `POST /orders/{id}/items` path when `billSpaAppointment` (`lib/spaOrderClient.ts`) bills the appointment, one entry per treatment row. See the backend's own CLAUDE.md, "Spa billing", for why price doesn't follow the room-nights frozen-rate pattern.

**The table map (`/admin/spa/map`) is CASHIER+ to view, MANAGER+ to place tables or replace the image.** `SpaMap.tables[]` (`GET /spa-map`) carries the same kind of enrichment `PropertyMap.units[]` already does for a room unit — `busy`/`nextAppointmentStartTime`/`appointments` computed server-side from one call to the day schedule, not a query per table (see `SpaMapTable`'s own openapi.yaml description). `lib/spaMapDisplay.ts#resolveSpaTableFill` is the display rule (`inactive` > `busy` > `free`, first match wins, mirroring `lib/propertyMapDisplay.ts`'s own priority-list shape) — a deactivated table is dimmed regardless of what else is true about it, same as a deactivated room. `SpaTableMapPanel.tsx` (opened the same tap-or-double-click way as everything else on this page) is read-only: there's no per-table action the way check-in/checkout is for a room, only a link out to the real schedule for that day.

## Public site

Guest-facing pages and the booking flow are not to be touched unless the task is about them. They are the only part real guests see, and they are the least covered by tests.

## Working style

When a decision is a judgment call — a data model, a permission boundary, anything touching money — present the options and a recommendation and wait, rather than choosing silently.

The staff manual quotes UI labels verbatim. Renaming a visible label breaks it; propose rather than rename.