"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { checkOutBooking, previewCheckOut } from "@/lib/bookingOccupancyClient";
import { formatDate } from "@/lib/formatDate";
import type { CheckOutInput, CheckOutPreview, CheckOutResult } from "@/lib/types";

const baht = (value: string | number) => `฿${Number(value).toLocaleString("en-US")}`;

type Charge = "stayed" | "full";

// The one check-out confirmation, used by the booking page, the Today board and the property map.
// Check-out used to be a single button with no confirmation that left the original dates standing,
// so a guest who left early kept the room sold, the nights in the night audit and the full price
// in lifetime value. For an early departure (the backend's preview decides what counts) this offers
// to end the stay today - the server shortens it through the ordinary schedule change - and makes
// the desk choose, every time, whether the released nights are still charged (kept as an
// early-departure charge) or not. Every amount shown comes from the server's preview.
export default function CheckOutDialog({
  bookingId,
  guestName,
  checkOut,
  onDone,
  onBack,
}: {
  bookingId: string;
  guestName: string;
  checkOut: string;
  onDone: (result: CheckOutResult) => void;
  onBack: () => void;
}) {
  const [preview, setPreview] = useState<CheckOutPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shorten, setShorten] = useState(true);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewCheckOut(bookingId).then((result) => {
      if (cancelled) return;
      if (result.ok) setPreview(result.preview);
      else setLoadError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const canShorten = preview !== null && preview.early && preview.shortenable;
  const shortening = canShorten && shorten;
  const needsChoice = shortening && charge === null;

  async function handleConfirm() {
    if (!preview) return;
    if (needsChoice) {
      setError("Choose what the guest pays for the room.");
      return;
    }
    setBusy(true);
    setError(null);
    const input: CheckOutInput | undefined = shortening ? { shortenStay: true, chargeUnusedNights: charge === "full" } : undefined;
    const result = await checkOutBooking(bookingId, input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone(result.result);
  }

  return (
    <ConfirmDialog
      eyebrow="Check out"
      title={`Check ${guestName} out now?`}
      confirmLabel={needsChoice ? "Choose what to charge" : "Check out"}
      busyLabel="Checking out…"
      busy={busy || (preview === null && loadError === null)}
      error={error ?? loadError}
      onConfirm={handleConfirm}
      onBack={onBack}
    >
      {preview && (
        <div className="space-y-3 text-sm text-cream/80">
          {Number(preview.outstandingBalance) > 0 ? (
            <p>
              Balance due now: <span className="text-coral font-medium">{baht(preview.outstandingBalance)}</span>
            </p>
          ) : (
            <p className="text-cream/60">Nothing is owed right now.</p>
          )}

          {preview.early && !preview.shortenable && (
            <p className="text-amber-400">
              They were booked until {formatDate(checkOut)}, but the stay can&rsquo;t be shortened from here: {preview.reason} The
              dates and price will stay as they are.
            </p>
          )}

          {canShorten && (
            <div className="space-y-2 rounded-lg border border-cream/15 p-3">
              <p>
                Booked until {formatDate(checkOut)} — leaving {preview.nightsReleased} night{preview.nightsReleased === 1 ? "" : "s"}{" "}
                early.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={shorten} onChange={(e) => setShorten(e.target.checked)} />
                <span>
                  End the stay on {formatDate(preview.shortenedCheckOut!)} and release the room from then (calendar, availability and
                  night audit follow).
                </span>
              </label>
              {shorten && (
                <fieldset className="space-y-2 pl-6">
                  <legend className="text-cream/60 mb-1">What does the guest pay for the room?</legend>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="charge" className="mt-1" checked={charge === "stayed"} onChange={() => setCharge("stayed")} />
                    <span>
                      Only the nights stayed — room {baht(preview.shortenedRoomTotal)}{" "}
                      <span className="text-cream/50">(drops {baht(preview.unusedNightsAmount)})</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="charge" className="mt-1" checked={charge === "full"} onChange={() => setCharge("full")} />
                    <span>
                      The full booking — room stays {baht(preview.currentRoomTotal)}{" "}
                      <span className="text-cream/50">({baht(preview.unusedNightsAmount)} as an early-departure charge)</span>
                    </span>
                  </label>
                </fieldset>
              )}
              {!shorten && <p className="text-cream/50 pl-6">The room stays booked and charged until {formatDate(checkOut)}.</p>}
            </div>
          )}
        </div>
      )}
    </ConfirmDialog>
  );
}
