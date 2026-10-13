"use client";

import { useEffect } from "react";

// Sets `data-hydrated` on <html> once React has taken over the page. See HydrationGate.
export default function HydrationMarker() {
  useEffect(() => {
    document.documentElement.setAttribute("data-hydrated", "");
  }, []);
  return null;
}
