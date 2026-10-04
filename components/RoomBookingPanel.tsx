"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import BookingGuestForm from "@/components/BookingGuestForm";
import { getRoomQuoteClient } from "@/lib/publicQuoteClient";
import { addDaysUTC, parseDateKey, toDateKey } from "@/lib/bookings";
import { formatQuoteTotal, type QuoteResult } from "@/lib/quote";
import type { BookingGuestPrefill } from "@/lib/bookingGuestForm";

const QUOTE_DEBOUNCE_MS = 500;

export default function RoomBookingPanel({
  roomId,
  initialCheckIn,
  initialCheckOut,
  initialQuote,
  guestAccount = null,
}: {
  roomId: string;
  initialCheckIn: string;
  initialCheckOut: string;
  initialQuote: QuoteResult;
  guestAccount?: BookingGuestPrefill | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Guards against a slower, earlier request resolving after a later one and
  // clobbering its result — the response for a fetch that's no longer the
  // most recent date selection is discarded.
  const latestRequestId = useRef(0);
  // The quote endpoint is rate limited per address (sunset's PublicQuoteRateLimiter), and a
  // native date input fires a change for every intermediate value while a year is typed digit by
  // digit - so a date change only asks the server once the range has settled for QUOTE_DEBOUNCE_MS.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [result, setResult] = useState<QuoteResult>(initialQuote);
  const [loading, setLoading] = useState(false);
  const checkInId = useId();
  const checkOutId = useId();

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  function fetchQuote(nextCheckIn: string, nextCheckOut: string) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
    const requestId = ++latestRequestId.current;
    setLoading(true);
    getRoomQuoteClient(roomId, nextCheckIn, nextCheckOut).then((next) => {
      if (latestRequestId.current !== requestId) return;
      setResult(next);
      setLoading(false);
    });
  }

  function scheduleQuote(nextCheckIn: string, nextCheckOut: string) {
    // Invalidate any request already in flight for the old range, and show "Updating…" (which
    // also disables the booking form) straight away rather than the old range's total.
    latestRequestId.current++;
    setLoading(true);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchQuote(nextCheckIn, nextCheckOut), QUOTE_DEBOUNCE_MS);
  }

  function commitDates(nextCheckIn: string, nextCheckOut: string) {
    setCheckIn(nextCheckIn);
    setCheckOut(nextCheckOut);
    router.replace(`${pathname}?checkIn=${nextCheckIn}&checkOut=${nextCheckOut}`);
    scheduleQuote(nextCheckIn, nextCheckOut);
  }

  function handleCheckInChange(value: string) {
    if (!value) return;
    const nextCheckOut = value >= checkOut ? toDateKey(addDaysUTC(parseDateKey(value), 1)) : checkOut;
    commitDates(value, nextCheckOut);
  }

  function handleCheckOutChange(value: string) {
    if (!value) return;
    const nextCheckOut = value <= checkIn ? toDateKey(addDaysUTC(parseDateKey(checkIn), 1)) : value;
    commitDates(checkIn, nextCheckOut);
  }

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4 items-end mb-10">
        <div>
          <label htmlFor={checkInId} className="eyebrow text-cream/40 block mb-1 text-center sm:text-left">Check-in</label>
          <input
            id={checkInId}
            type="date"
            value={checkIn}
            onChange={(e) => handleCheckInChange(e.target.value)}
            className="w-full bg-transparent border-b border-cream/25 py-2 text-base text-center sm:text-left focus:outline-none focus:border-coral"
          />
        </div>
        <div>
          <label htmlFor={checkOutId} className="eyebrow text-cream/40 block mb-1 text-center sm:text-left">Check-out</label>
          <input
            id={checkOutId}
            type="date"
            value={checkOut}
            onChange={(e) => handleCheckOutChange(e.target.value)}
            className="w-full bg-transparent border-b border-cream/25 py-2 text-base text-center sm:text-left focus:outline-none focus:border-coral"
          />
        </div>
        <div>
          <p className="eyebrow text-cream/40 text-center">Total</p>
          <p className="mt-1 text-coral font-display text-lg text-center">
            {loading ? "Updating…" : result.ok ? formatQuoteTotal(result.quote) : "—"}
          </p>
        </div>
      </div>

      {/* While a new quote is pending the previous outcome stays on screen (the booking form
          disabled, not unmounted, so what the guest already typed survives a date change). */}
      {!result.ok ? (
        <p className="text-center text-coral">
          {result.message}{" "}
          {/* A 400 means these dates themselves were rejected - asking again won't change that. */}
          {!loading && result.status !== 400 && (
            <button
              type="button"
              onClick={() => fetchQuote(checkIn, checkOut)}
              className="underline underline-offset-4"
            >
              Try again
            </button>
          )}
        </p>
      ) : result.quote.available ? (
        <BookingGuestForm
          roomId={roomId}
          checkIn={checkIn}
          checkOut={checkOut}
          disabled={loading}
          guestAccount={guestAccount}
        />
      ) : (
        <p className="text-center text-coral">
          {result.quote.reason ?? "Sorry, this room is no longer available for those dates."}{" "}
          <Link href={`/booking?checkIn=${checkIn}&checkOut=${checkOut}`} className="underline underline-offset-4">
            See other rooms
          </Link>
        </p>
      )}
    </>
  );
}
