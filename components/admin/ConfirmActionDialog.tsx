"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

// ConfirmDialog with the busy/error plumbing already done, for the common "are you sure?" whose
// answer is one request: `action` returns null on success (the dialog closes through `onDone`) or
// the failure's text, which is shown inside the dialog next to the button while it stays open for a
// retry. Replaces the browser's window.confirm() everywhere in the admin - see ConfirmDialog for
// why. A screen that needs inputs or its own flow (CheckOutDialog, CancelBookingDialog) builds on
// ConfirmDialog directly instead.
export default function ConfirmActionDialog({
  eyebrow,
  title,
  children,
  confirmLabel,
  busyLabel,
  backLabel,
  action,
  onDone,
  onBack,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  backLabel?: string;
  action: () => Promise<string | null>;
  onDone: () => void;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    const failure = await action();
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    onDone();
  }

  return (
    <ConfirmDialog
      eyebrow={eyebrow}
      title={title}
      confirmLabel={confirmLabel}
      busyLabel={busyLabel}
      backLabel={backLabel}
      busy={busy}
      error={error}
      onConfirm={handleConfirm}
      onBack={onBack}
    >
      {children}
    </ConfirmDialog>
  );
}
