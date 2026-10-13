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
let ownBacksPending = 0;
let listening = false;

function onPopState() {
  if (ownBacksPending > 0) {
    ownBacksPending--;
    return;
  }
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
        window.addEventListener("popstate", onPopState);
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
          ownBacksPending++;
          window.history.back();
        }
      }, 0);
    };
  }, [active]);
}
