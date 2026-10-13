"use client";

import { useEffect, useRef } from "react";

// The browser's Back button while a data-entry modal is open: without this it leaves the page and
// the half-typed booking goes with it. While `active`, the modal owns one extra history entry; Back
// pops it, which closes the modal and keeps the page. Closing the modal any other way (the button,
// the backdrop, a save) gives that entry back, so the history is left as it was found.
//
// - The entry is pushed one tick late and a cleanup that ran before the push cancels it, so React
//   strict mode's mount/unmount/mount in development leaves exactly one entry, and never a
//   queued `back()` that the second mount's popstate listener would mistake for a Back press.
// - The entry copies `history.state`: the App Router keeps its own bookkeeping in there and reloads
//   the page when it meets a state it doesn't recognise.
// - Give the entry back only while it is still the current one. After a link inside the modal has
//   navigated, the current entry is the new page's, and `back()` would undo that navigation. Pass
//   `active = false` before such a link can be followed (the "Open booking" link of a created booking).
export function useCloseOnBrowserBack(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    let pushed = false;
    let closedByBack = false;

    const timer = window.setTimeout(() => {
      window.history.pushState({ ...(window.history.state ?? {}), __modalEntry: true }, "", window.location.href);
      pushed = true;
    }, 0);

    function onPopState() {
      if (!pushed) return;
      closedByBack = true;
      onCloseRef.current();
    }
    window.addEventListener("popstate", onPopState);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPopState);
      if (pushed && !closedByBack && window.history.state?.__modalEntry) window.history.back();
    };
  }, [active]);
}
