"use client";

import { useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import BookingGuestForm from "@/components/BookingGuestForm";
import { getRoomQuoteClient } from "@/lib/publicQuoteClient";
import { addDaysUTC, parseDateKey, toDateKey } from "@/lib/bookings";
import type { RoomQuote } from "@/lib/quote";

export default function RoomBookingPanel({
  roomId,
  initialCheckIn,
  initialCheckOut,
  initialQuote,
}: {
  roomId: string;
  initialCheckIn: string;
  initialCheckOut: string;
  initialQuote: RoomQuote;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Guards against a slower, earlier request resolving after a later one and
  // clobbering its result — the response for a fetch that's no longer the
  // most recent date selection is discarded.
  const latestRequestId = useRef(0);

  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [quote, setQuote] = useState<RoomQuote>(initialQuote);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  function fetchQuote(nextCheckIn: string, nextCheckOut: string) {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    setFetchError(false);
    getRoomQuoteClient(roomId, nextCheckIn, nextCheckOut)
      .then((result) => {
        if (latestRequestId.current !== requestId) return;
        setQuote(result);
        setLoading(false);
      })
      .catch(() => {
        if (latestRequestId.current !== requestId) return;
        setFetchError(true);
        setLoading(false);
      });
  }

  function commitDates(nextCheckIn: string, nextCheckOut: string) {
    setCheckIn(nextCheckIn);
    setCheckOut(nextCheckOut);
    router.replace(`${pathname}?checkIn=${nextCheckIn}&checkOut=${nextCheckOut}`);
    fetchQuote(nextCheckIn, nextCheckOut);
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
          <label className="eyebrow text-cream/40 block mb-1 text-center sm:text-left">Check-in</label>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => handleCheckInChange(e.target.value)}
            className="w-full bg-transparent border-b border-cream/25 py-1 text-sm text-center sm:text-left focus:outline-none focus:border-coral"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/40 block mb-1 text-center sm:text-left">Check-out</label>
          <input
            type="date"
            value={checkOut}
            onChange={(e) => handleCheckOutChange(e.target.value)}
            className="w-full bg-transparent border-b border-cream/25 py-1 text-sm text-center sm:text-left focus:outline-none focus:border-coral"
          />
        </div>
        <div>
          <p className="eyebrow text-cream/40 text-center">Total</p>
          <p className="mt-1 text-coral font-display text-lg text-center">
            {loading
              ? "Updating…"
              : quote.totalPrice !== null
                ? `฿${quote.totalPrice.toLocaleString("en-US")}`
                : "—"}
          </p>
        </div>
      </div>

      {fetchError ? (
        <p className="text-center text-coral">
          Couldn&rsquo;t check pricing and availability for those dates.{" "}
          <button
            type="button"
            onClick={() => fetchQuote(checkIn, checkOut)}
            className="underline underline-offset-4"
          >
            Try again
          </button>
        </p>
      ) : quote.available ? (
        <BookingGuestForm roomId={roomId} checkIn={checkIn} checkOut={checkOut} disabled={loading} />
      ) : (
        <p className="text-center text-coral">
          Sorry, this room is no longer available for those dates.{" "}
          <Link href={`/booking?checkIn=${checkIn}&checkOut=${checkOut}`} className="underline underline-offset-4">
            See other rooms
          </Link>
        </p>
      )}
    </>
  );
}
