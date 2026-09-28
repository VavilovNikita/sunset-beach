"use client";

import { BOOKING_PURPOSES, BOOKING_PURPOSE_LABELS } from "@/lib/bookingPurpose";
import type { BookingPurpose } from "@/lib/types";

// Purpose + party size, shared by the new-booking modal and both booking edit forms so the three
// can't drift apart. Adults/children are strings while typing - see parsePartySize.
export default function BookingPurposePartyFields({
  purpose,
  onPurposeChange,
  adults,
  onAdultsChange,
  childCount,
  onChildCountChange,
  inputClassName,
}: {
  purpose: BookingPurpose;
  onPurposeChange: (purpose: BookingPurpose) => void;
  adults: string;
  onAdultsChange: (adults: string) => void;
  childCount: string;
  onChildCountChange: (childCount: string) => void;
  inputClassName: string;
}) {
  return (
    <>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Purpose</label>
        <select value={purpose} onChange={(e) => onPurposeChange(e.target.value as BookingPurpose)} className={inputClassName}>
          {BOOKING_PURPOSES.map((p) => (
            <option key={p} value={p}>
              {BOOKING_PURPOSE_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="eyebrow text-cream/60 block mb-1">Adults</label>
          <input
            type="number"
            min={1}
            step={1}
            value={adults}
            onChange={(e) => onAdultsChange(e.target.value)}
            required
            className={inputClassName}
          />
        </div>
        <div className="flex-1">
          <label className="eyebrow text-cream/60 block mb-1">Children</label>
          <input
            type="number"
            min={0}
            step={1}
            value={childCount}
            onChange={(e) => onChildCountChange(e.target.value)}
            className={inputClassName}
          />
        </div>
      </div>
    </>
  );
}
