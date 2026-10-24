"use client";

import { extractApiError } from "@/lib/apiError";
import { useState } from "react";
import Link from "next/link";
import { PUBLIC_PROXY_URL } from "@/lib/backend";
import {
  DEFAULT_ADULTS,
  bookingRequestBody,
  clampAdults,
  clampChildren,
  guestFormDefaults,
  maxChildren,
  type BookingGuestPrefill,
} from "@/lib/bookingGuestForm";

export default function BookingGuestForm({
  roomId,
  checkIn,
  checkOut,
  disabled = false,
  guestAccount = null,
  capacity,
}: {
  roomId: string;
  checkIn: string;
  checkOut: string;
  disabled?: boolean;
  guestAccount?: BookingGuestPrefill | null;
  // Room.capacity - the most guests (adults + children) the room takes; the server refuses a public booking over it.
  capacity: number;
}) {
  const defaults = guestFormDefaults(guestAccount);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [adults, setAdults] = useState(DEFAULT_ADULTS);
  const [children, setChildren] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await fetch(`${PUBLIC_PROXY_URL}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingRequestBody(roomId, checkIn, checkOut, formData)),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setStatus("error");
      // The server's own reason (party over the room's capacity, dates taken, ...) - the generic line only when it sent none.
      setError(extractApiError(data, "Something went wrong. Please try again."));
      return;
    }

    const booking = await res.json();
    setBookingId(booking.id);
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="bg-ink2/40 border border-cream/10 rounded-xl p-6 text-center">
        <p className="font-display italic text-xl text-coral mb-2">Request received</p>
        <p className="text-cream/70 text-sm">
          Thank you — your booking request (#{bookingId?.slice(-8)}) has been sent to our team. We&rsquo;ll confirm
          availability and follow up by email shortly.
        </p>
      </div>
    );
  }

  const FIELD = "w-full bg-transparent border-b border-cream/25 py-2 text-cream placeholder:text-cream/30 focus:outline-none focus:border-coral";
  const LABEL = "eyebrow text-cream/60 block mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="guestName" className={LABEL}>Your name</label>
        <input id="guestName" type="text" name="guestName" defaultValue={defaults.guestName} autoComplete="name" minLength={2} required className={FIELD} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="guestEmail" className={LABEL}>Email</label>
          <input id="guestEmail" type="email" name="guestEmail" defaultValue={defaults.guestEmail} autoComplete="email" required className={FIELD} />
        </div>
        <div>
          <label htmlFor="guestPhone" className={LABEL}>Phone</label>
          <input id="guestPhone" type="tel" name="guestPhone" autoComplete="tel" placeholder="+66 …" minLength={5} required className={FIELD} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="adults" className={LABEL}>Adults</label>
          <input
            id="adults"
            type="number"
            name="adults"
            min={1}
            max={Math.max(1, capacity)}
            step={1}
            required
            value={adults}
            onChange={(e) => {
              const next = clampAdults(Number(e.target.value), capacity);
              setAdults(next);
              setChildren((c) => clampChildren(c, capacity, next));
            }}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="children" className={LABEL}>Children</label>
          <input
            id="children"
            type="number"
            name="children"
            min={0}
            max={maxChildren(capacity, adults)}
            step={1}
            value={children}
            onChange={(e) => setChildren(clampChildren(Number(e.target.value), capacity, adults))}
            className={FIELD}
          />
        </div>
      </div>
      <p className="text-xs text-cream/40">This room sleeps up to {capacity} {capacity === 1 ? "guest" : "guests"} in total.</p>

      <label className="flex items-start gap-3 text-sm text-cream/70">
        <input type="checkbox" required className="mt-0.5 h-4 w-4 accent-coral" />
        <span>
          I have read and accept the{" "}
          <Link href="/terms" target="_blank" className="underline underline-offset-4 hover:text-cream">
            terms &amp; conditions
          </Link>
          .
        </span>
      </label>

      {status === "error" && (
        <p className="text-sm text-coral">
          {error}{" "}
          <Link href="/booking" className="underline underline-offset-4">
            Back to search
          </Link>
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || status === "sending"}
        className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Request booking"}
      </button>
    </form>
  );
}
