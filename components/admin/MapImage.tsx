"use client";

import { useEffect, useRef } from "react";

// The background <img> of a map screen, reporting when it did not load. onError alone is not
// enough: the page is server-rendered, so the browser can finish (and fail) the request before
// React has attached its handler, and that error is never delivered. After mounting, an image the
// browser already gave up on is `complete` with no pixels - checked here too.
export default function MapImage({
  src,
  alt,
  className,
  onFailed,
}: {
  src: string;
  alt: string;
  className?: string;
  onFailed: () => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) onFailed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated, proxied image; next/image can't reach it
    <img ref={ref} src={src} alt={alt} className={className} draggable={false} onError={onFailed} />
  );
}
