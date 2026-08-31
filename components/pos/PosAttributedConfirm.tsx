"use client";

// Shared confirmation UI for every money-affecting action (closing an order with payment,
// charging to room, closing a shift) — deliberately not a silent one-tap action for any of
// these, unlike everything else in this section. The backend has no concept of "acting as"
// separate from "logged in as" (every write is attributed to the JWT holder alone - see
// PosTopBar's comment), so the only place a wrong identity can still be caught is right here,
// in the instant before the action is sent: if the name shown is the wrong person, a cashier
// notices *before* it lands in history, not after, when there'd be nothing left to do but a
// manual correction. Reused as-is by the three call sites rather than three near-identical
// blocks, so the wording/layout can't quietly drift out of sync between them.
export default function PosAttributedConfirm({
  title,
  detail,
  actorEmail,
  actorRole,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  error,
}: {
  title: string;
  detail?: string;
  actorEmail: string;
  actorRole: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  error?: string | null;
}) {
  return (
    <div className="bg-ink2 border border-coral/50 rounded-2xl p-4 space-y-3">
      <p className="eyebrow text-cream/60">{title}</p>
      {detail && <p className="font-display italic text-2xl text-coral">{detail}</p>}

      <div className="bg-ink border border-coral/30 rounded-xl px-4 py-3">
        <p className="eyebrow text-coral/80 mb-1">Will be recorded as</p>
        <p className="text-cream text-base font-medium break-words">{actorEmail}</p>
        <p className="text-xs text-cream/50">{actorRole}</p>
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 rounded-xl bg-coral active:bg-coraldeep transition-colors py-3.5 text-sm font-medium disabled:opacity-60"
        >
          {busy ? "…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-xl border border-cream/25 active:border-cream/50 transition-colors py-3.5 text-sm font-medium disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
