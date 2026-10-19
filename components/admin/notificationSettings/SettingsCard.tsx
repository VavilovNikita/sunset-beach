"use client";

import type { ReactNode } from "react";

export const INPUT = "bg-ink border border-cream/20 rounded-lg px-3 py-2 min-h-[44px] text-sm";

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-coral mt-1">{message}</p> : null;
}

// One card of the notification settings. `short` is the one line under the title; `more` (the long explanation)
// is behind "More". A card with a master switch (`enabled`/`onToggle`) shows it in the header, and while it is Off
// the card is just its title and that line - the fields are folded away, not greyed out. `hasError` keeps a card
// open while one of its fields is wrong (a hidden field with an error would be a Save that fails for no visible
// reason). A card without a master switch (its parts have their own) is always open.
export default function SettingsCard({
  title,
  short,
  more,
  enabled,
  onToggle,
  switchLabel,
  hasError,
  children,
}: {
  title: string;
  short: string;
  more?: ReactNode;
  enabled?: boolean;
  onToggle?: (value: boolean) => void;
  // What the switch is called when that is not the card's title (a label the staff manual quotes).
  switchLabel?: string;
  hasError?: boolean;
  children?: ReactNode;
}) {
  const open = enabled !== false || hasError === true;
  const hasBody = children !== undefined && children !== null && children !== false;
  return (
    <section className="bg-ink2/40 border border-cream/10 rounded-xl p-5 space-y-3 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm text-cream font-medium pt-3">{title}</h3>
        {onToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled === true}
            aria-label={switchLabel ?? title}
            onClick={() => onToggle(enabled !== true)}
            className="shrink-0 inline-flex items-center gap-2 min-h-[44px] px-1 text-xs text-cream/70"
          >
            {switchLabel && switchLabel !== title && <span className="hidden sm:inline max-w-[14rem] truncate">{switchLabel}</span>}
            <span
              aria-hidden="true"
              className={`relative inline-block h-5 w-9 rounded-full border transition-colors ${enabled ? "bg-coral border-coral" : "bg-ink border-cream/30"}`}
            >
              <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-cream transition-all ${enabled ? "left-[1.1rem]" : "left-0.5"}`} />
            </span>
            <span className="w-6 text-left font-medium">{enabled ? "On" : "Off"}</span>
          </button>
        )}
      </div>
      <p className="text-xs text-cream/50">{short}</p>
      {more && open && (
        <details className="text-xs text-cream/50">
          <summary className="cursor-pointer text-cream/60 hover:text-cream inline-flex items-center min-h-[32px]">More</summary>
          <div className="mt-1 space-y-2">{more}</div>
        </details>
      )}
      {open && hasBody && <div className="space-y-3">{children}</div>}
    </section>
  );
}
