"use client";

// Shared confirmation UI for a money-affecting action (closing an order with payment, closing a
// shift) — deliberately not a silent one-tap action for either of these, unlike everything else
// in this section. The backend has no concept of "acting as" separate from "logged in as" (every
// write is attributed to the JWT holder alone - see PosTopBar's comment), so the only place a
// wrong identity can still be caught is right here, in the instant before the action is sent: if
// the name shown is the wrong person, a cashier notices *before* it lands in history, not after,
// when there'd be nothing left to do but a manual correction. Reused as-is by its two call sites
// (OrderTicket.tsx, PosShiftPanel.tsx) rather than two near-identical blocks, so the wording/
// layout can't quietly drift out of sync between them. The third money-affecting phone action,
// charging to room (RoomChargeSearch.tsx), shows the same "will be recorded as" identity
// block but not through this component - its own two-step picker-then-confirm flow doesn't fit
// this component's single title/detail/confirm-button shape, so it hand-rolls the identity
// display and pairs it with its own Confirm/Back buttons instead.
//
// The identity block is /pos-only: OrderTicket.tsx (shared by both surfaces) also uses this card
// for the cash close on the desktop till - it needs somewhere to type the amount received - but
// passes no actor there, so the "will be recorded as" block isn't rendered, and Card / Charge to
// room close without a confirm at all. That asymmetry is intentional, not a gap: a till/register
// is understood to belong to whoever is on shift at it for the whole shift, unlike a phone that
// gets handed between whoever's nearest a table. Same note at ShiftPanel.tsx from the other side.
export default function PosAttributedConfirm({
  title,
  detail,
  actorEmail,
  actorRole,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  busy,
  error,
  confirmDisabled = false,
  children,
}: {
  title: string;
  detail?: string;
  // Omitted on the desktop till - see above.
  actorEmail?: string;
  actorRole?: string;
  confirmLabel: string;
  // The back-out button. "Cancel" reads wrong next to an action that is itself a cancellation
  // ("Cancel order" / "Cancel"), so those callers name it ("Keep order").
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  error?: string | null;
  // Extra input the action needs before it can be confirmed (the cash close's amount received).
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-ink2 border border-coral/50 rounded-2xl p-4 space-y-3">
      <p className="eyebrow text-cream/60">{title}</p>
      {detail && <p className="font-display italic text-2xl text-coral">{detail}</p>}
      {children}

      {actorEmail !== undefined && (
        <div className="bg-ink border border-coral/30 rounded-xl px-4 py-3">
          <p className="eyebrow text-coral/80 mb-1">Will be recorded as</p>
          <p className="text-cream text-base font-medium break-words">{actorEmail}</p>
          <p className="text-xs text-cream/50">{actorRole}</p>
        </div>
      )}

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
          className="flex-1 rounded-xl bg-coral hover:bg-coraldeep active:bg-coraldeep transition-colors py-3.5 text-sm font-medium disabled:opacity-60"
        >
          {busy ? "…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-xl border border-cream/25 hover:border-cream/50 active:border-cream/50 transition-colors py-3.5 text-sm font-medium disabled:opacity-60"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
