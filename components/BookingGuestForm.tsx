"use client";

import { useState } from "react";
import Link from "next/link";

export default function BookingGuestForm({
  roomId,
  checkIn,
  checkOut,
}: {
  roomId: string;
  checkIn: string;
  checkOut: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        checkIn,
        checkOut,
        guestName: formData.get("guestName"),
        guestEmail: formData.get("guestEmail"),
        guestPhone: formData.get("guestPhone"),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setStatus("error");
      setError(typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.");
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          name="guestName"
          placeholder="Your name"
          minLength={2}
          required
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <input
          type="email"
          name="guestEmail"
          placeholder="Email"
          required
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <input
          type="tel"
          name="guestPhone"
          placeholder="Phone"
          minLength={5}
          required
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>

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
        disabled={status === "sending"}
        className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Request booking"}
      </button>
    </form>
  );
}
