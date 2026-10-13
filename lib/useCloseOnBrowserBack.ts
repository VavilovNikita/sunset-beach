"use client";

import { useEffect, useRef } from "react";

// The browser's Back button while a modal, dialog or side panel is open: without this it leaves the
// page and whatever was typed goes with it. While `active`, the overlay owns one extra history
// entry; Back pops it, which closes the overlay and keeps the page. Closing the overlay any other
// way (its button, the backdrop, a save) gives that entry back, so the history is left as it was found.
//
// Overlays stack (a confirm dialog opened from a side panel), so one shared popstate listener closes
// only the topmost, and a `back()` we call ourselves is counted and ignored by that listener.
//
// A `back()` we call ourselves is also kept away from the Next router. It lands on an entry that is
// identical to the page already on screen (the overlay's entry was a copy of it), so there is nothing
// for the router to restore - but it would restore anyway, from the state stored in that entry, which
// predates anything the page did since. A `router.refresh()` issued as the overlay closed (every
// "created / saved / cancelled" handler does exactly that) was lost that way: the new row only showed
// after the next navigation, whenever the server answered before the popstate was handled. Hence the
// popstate of our own `back()` is swallowed (`stopImmediatePropagation`) before the router sees it,
// and a refresh in flight always lands. A popstate the user causes (the Back button) is not ours
// and still reaches the router as before.
//
// "Before the router" is a matter of registration order: listeners on `window` run in the order
// they were added, whatever their capture flag, and the router adds its own once, at hydration. So
// the swallowing listener is an inline script in `HydrationGate` (rendered by every layout that has
// overlays), which runs at parse time, ahead of any React code - the same trick that layout already
// uses for clicks. It and this module share one counter, `globalThis.__overlayOwnBacks`. The
// listener this module adds itself when the first overlay opens is the fallback for a page without
// that script (it keeps the overlay stack right, but is too late to keep the router out of it).
//
// - The entry is pushed one tick late and a cleanup that ran before the push cancels it, so React
//   strict mode's mount/unmount/mount in development leaves exactly one entry.
// - The entry copies `history.state`: the App Router keeps its own bookkeeping in there and reloads
//   the page when it meets a state it doesn't recognise.
// - The entry is given back one tick after the overlay goes, and only if it is still the current one.
//   When the overlay closed because a link or `router.push` navigated away, the current entry is the
//   new page's (or the navigation is still in flight and will push on top of the restored page), and
//   an immediate `back()` would race it. Pass `active = false` before following a link inside an
//   overlay that stays mounted (the "Open booking" link of a created booking).
type Entry = { close: () => void };

const stack: Entry[] = [];
let listening = false;

type OwnBacks = { __overlayOwnBacks?: number };
const shared = globalThis as OwnBacks;

// True (and the event swallowed) when this popstate is the echo of a `back()` this module called itself.
export function consumeOwnPopState(event: { stopImmediatePropagation(): void }): boolean {
  const pending = shared.__overlayOwnBacks ?? 0;
  if (pending <= 0) return false;
  shared.__overlayOwnBacks = pending - 1;
  event.stopImmediatePropagation();
  return true;
}

// Called right before `history.back()` on the overlay's behalf, so its popstate is recognised as ours.
export function noteOwnBack(): void {
  shared.__overlayOwnBacks = (shared.__overlayOwnBacks ?? 0) + 1;
}

function onPopState(event: Event) {
  if (consumeOwnPopState(event)) return;
  stack.pop()?.close();
}

export function useCloseOnBrowserBack(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const entry: Entry = { close: () => onCloseRef.current() };
    let pushed = false;

    const timer = window.setTimeout(() => {
      if (!listening) {
        window.addEventListener("popstate", onPopState, { capture: true });
        listening = true;
      }
      window.history.pushState({ ...(window.history.state ?? {}), __modalEntry: true }, "", window.location.href);
      stack.push(entry);
      pushed = true;
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (!pushed) return;
      const at = stack.indexOf(entry);
      if (at === -1) return; // Back already popped it
      stack.splice(at, 1);
      window.setTimeout(() => {
        if (window.history.state?.__modalEntry) {
          noteOwnBack();
          window.history.back();
        }
      }, 0);
    };
  }, [active]);
}
