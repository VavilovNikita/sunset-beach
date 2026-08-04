"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BookingBarProps = {
  // Optional controlled mode: pass these when a parent page needs to read
  // the in-progress dates (e.g. to carry them into a per-room booking link)
  // before the form is submitted. Omit all four to keep BookingBar's
  // default self-contained (uncontrolled) behavior.
  checkIn?: string;
  checkOut?: string;
  onCheckInChange?: (value: string) => void;
  onCheckOutChange?: (value: string) => void;
};

export default function BookingBar({
  checkIn: checkInProp,
  checkOut: checkOutProp,
  onCheckInChange,
  onCheckOutChange,
}: BookingBarProps = {}) {
  const router = useRouter();
  const [checkInState, setCheckInState] = useState("");
  const [checkOutState, setCheckOutState] = useState("");
  const [error, setError] = useState<string | null>(null);

  const checkIn = checkInProp ?? checkInState;
  const checkOut = checkOutProp ?? checkOutState;
  const setCheckIn = onCheckInChange ?? setCheckInState;
  const setCheckOut = onCheckOutChange ?? setCheckOutState;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn || !checkOut) {
      setError("Please choose both dates.");
      return;
    }
    if (checkIn >= checkOut) {
      setError("Check-out must be after check-in.");
      return;
    }
    setError(null);
    router.push(`/booking?checkIn=${checkIn}&checkOut=${checkOut}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative z-10 mx-auto max-w-4xl -mt-10 md:-mt-14 px-4">
      <div className="bg-sand text-ink rounded-2xl shadow-2xl shadow-black/40 px-6 py-5 grid gap-4 sm:grid-cols-3 items-end">
        <div>
          <label className="eyebrow text-coraldeep block mb-1">Check in</label>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full bg-transparent border-b border-ink/20 py-1 text-sm focus:outline-none focus:border-coral"
          />
        </div>
        <div>
          <label className="eyebrow text-coraldeep block mb-1">Check out</label>
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full bg-transparent border-b border-ink/20 py-1 text-sm focus:outline-none focus:border-coral"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors text-cream text-sm font-medium py-2.5"
        >
          Check Availability
        </button>
      </div>
      {error && <p className="text-center text-sm text-coral mt-2">{error}</p>}
      <p className="text-center eyebrow text-cream/50 mt-3">Best Price Guaranteed · Booking direct with the resort</p>
    </form>
  );
}
