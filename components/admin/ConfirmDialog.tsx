"use client";

// The admin's confirmation dialog - the modal CancelBookingDialog introduced, extracted so every
// "are you sure?" in the office admin looks and behaves the same instead of falling back to the
// browser's own window.confirm() (unstyled, can't show a failure, blocked by some browsers once
// dismissed a few times). Backdrop click and the back button both back out; a failed action shows
// its error here, next to the button that triggered it, and the dialog stays open for a retry.
//
// The phone POS has its own inline pattern for the same job (components/pos/PosAttributedConfirm.tsx,
// with the "will be recorded as" identity block) - use that one inside an order ticket.
export default function ConfirmDialog({
  eyebrow,
  title,
  children,
  confirmLabel,
  busyLabel,
  backLabel = "Back",
  busy,
  error,
  onConfirm,
  onBack,
}: {
  eyebrow: string;
  title: string;
  // Extra explanation or inputs (a required reason, say).
  children?: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  backLabel?: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-ink/80 flex items-center justify-center p-4" onClick={busy ? undefined : onBack}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-ink2 border border-coral/40 rounded-xl p-6 max-w-md w-full space-y-4 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="eyebrow text-coral mb-1">{eyebrow}</p>
          <p className="text-cream">{title}</p>
        </div>
        {children}
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {busy ? (busyLabel ?? "…") : confirmLabel}
          </button>
          <button type="button" onClick={onBack} disabled={busy} className="text-sm text-cream/60 hover:text-cream transition-colors">
            {backLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
