"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// An image served from the uploads volume (room photos, maintenance photos, ...). The database keeps
// the path while the file lives on the server's disk, so a path can outlive its file - and a plain
// <img>/<Image> then shows the browser's broken-image icon, or a collapsed empty box. This shows a
// tidy "file not found" tile in the same box instead (the same idea as lib/mapImageFallback.ts for the
// floor plans, for the small pictures).
//
//  - `fill` (next/image, the parent is `relative` with its own size) or plain <img> sized by `className`;
//  - `label` is what the tile says: "File not found" for staff, "Photo unavailable" on the public site;
//  - the failure is remembered per `src`, so replacing the file (a new URL) gets a fresh try;
//  - a plain <img> that failed before React attached onError (server-rendered page) is caught after
//    mount by `complete && naturalWidth === 0`; next/image does that check itself.
export default function UploadedImage({
  src,
  alt,
  className = "",
  label = "File not found",
  fill = false,
  sizes,
  unoptimized,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  label?: string;
  fill?: boolean;
  sizes?: string;
  unoptimized?: boolean;
  priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (!fill && img && img.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src, fill]);

  if (failedSrc === src) {
    return (
      <div
        role="img"
        aria-label={`${label}${alt ? `: ${alt}` : ""}`}
        className={`${fill ? "absolute inset-0" : "w-full h-full"} flex flex-col items-center justify-center gap-1 bg-ink3 border border-dashed border-cream/20 text-cream/50 text-[10px] leading-tight text-center px-1 overflow-hidden`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 16l5-5 4 4 3-3 6 6" />
          <path d="M4 4l16 16" />
        </svg>
        <span>{label}</span>
      </div>
    );
  }

  if (fill) {
    return (
      <Image src={src} alt={alt} fill sizes={sizes} className={className} unoptimized={unoptimized} priority={priority} onError={() => setFailedSrc(src)} />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- authenticated, proxied image; next/image can't reach it
  return <img ref={ref} src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} />;
}
