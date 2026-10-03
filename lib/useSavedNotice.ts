"use client";

import { useEffect, useRef, useState } from "react";

// A short "Saved." / "Booking cancelled." confirmation shown next to the Save button after a
// successful write, cleared after a few seconds. This app has no toast system; the result of an
// action is shown next to the control that triggered it, same as its failure (see CLAUDE.md,
// "Requests and failures").
export function useSavedNotice(durationMs = 4000): [string | null, (message: string) => void, () => void] {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function show(message: string) {
    if (timer.current) clearTimeout(timer.current);
    setNotice(message);
    timer.current = setTimeout(() => setNotice(null), durationMs);
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    setNotice(null);
  }

  return [notice, show, clear];
}
