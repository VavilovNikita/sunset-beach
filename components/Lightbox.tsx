"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

export type LightboxImage = { src: string; unoptimized?: boolean };

type LightboxProps = {
  images: LightboxImage[];
  alt: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

const SWIPE_THRESHOLD_PX = 50;

export default function Lightbox({ images, alt, index, onIndexChange, onClose }: LightboxProps) {
  const touchStartX = useRef<number | null>(null);

  function goPrev() {
    onIndexChange((index - 1 + images.length) % images.length);
  }

  function goNext() {
    onIndexChange((index + 1) % images.length);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images.length]);

  // Lock background scroll while the lightbox is open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > SWIPE_THRESHOLD_PX) goPrev();
    else if (delta < -SWIPE_THRESHOLD_PX) goNext();
    touchStartX.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 text-cream/80 hover:text-cream w-10 h-10 flex items-center justify-center rounded-full bg-ink/40 hover:bg-ink/60 transition-colors"
        aria-label="Close"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-2 sm:left-6 text-cream/80 hover:text-cream w-11 h-11 flex items-center justify-center rounded-full bg-ink/40 hover:bg-ink/60 transition-colors"
          aria-label="Previous photo"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      )}

      <div
        className="relative w-full max-w-4xl aspect-[4/3] max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={images[index].src}
          alt={alt}
          fill
          sizes="90vw"
          className="object-contain"
          unoptimized={images[index].unoptimized}
          priority
        />
      </div>

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-2 sm:right-6 text-cream/80 hover:text-cream w-11 h-11 flex items-center justify-center rounded-full bg-ink/40 hover:bg-ink/60 transition-colors"
          aria-label="Next photo"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}

      {images.length > 1 && (
        <p className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 eyebrow text-cream/70 bg-ink/40 px-3 py-1 rounded-full">
          {index + 1} / {images.length}
        </p>
      )}
    </div>
  );
}
