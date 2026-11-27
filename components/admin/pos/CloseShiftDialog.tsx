"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { ShiftCloseFields, useShiftClose } from "@/components/admin/pos/shiftClose";
import { adminRequest } from "@/lib/adminFetch";
import { shiftOpeningFacts } from "@/lib/shiftReconciliation";
import type { ShiftSummary } from "@/lib/posTypes";

// A manager closing a shift from Shift history - usually one somebody left open (the server lets MANAGER+ close any
// shift and records who closed it). The drawer's figures are read first; counting and the note work as for one's own.
export default function CloseShiftDialog({
  shiftId,
  openedByName,
  onClosed,
  onBack,
}: {
  shiftId: string;
  openedByName: string;
  onClosed: (warning: string | null) => void;
  onBack: () => void;
}) {
  const [shift, setShift] = useState<ShiftSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const close = useShiftClose(shift, ({ warning }) => onClosed(warning));

  useEffect(() => {
    let cancelled = false;
    adminRequest<ShiftSummary>(`/shifts/${shiftId}`, undefined, "Could not load this shift.").then((result) => {
      if (cancelled) return;
      if (result.ok) setShift(result.data);
      else setLoadError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [shiftId]);

  const facts = shift ? shiftOpeningFacts(shift) : null;

  return (
    <ConfirmDialog
      eyebrow="Close shift"
      title={`Close ${openedByName}'s shift?`}
      confirmLabel="Close shift"
      busyLabel="Closing…"
      busy={close.submitting || (shift === null && loadError === null)}
      error={loadError}
      onConfirm={close.submit}
      onBack={onBack}
    >
      {shift && facts && (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-cream/60">
            Opened {facts.openedAt} · {shift.openingCashFloat === null ? "no opening float entered" : `float ${facts.openingFloat}`}. Count
            the drawer: you are recorded as the one who closed it.
          </p>
          <ShiftCloseFields shift={shift} close={close} ownerName={openedByName} />
        </div>
      )}
    </ConfirmDialog>
  );
}
