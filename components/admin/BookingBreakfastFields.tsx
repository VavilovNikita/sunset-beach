"use client";

import { BREAKFAST_RATES } from "@/lib/bookingBreakfast";

// Breakfast guests per night and the rate, shared by both booking edit forms (the booking page and the side panel) so
// they can't drift apart. Strings while typing - see lib/bookingBreakfast.ts#parseBreakfast.
export default function BookingBreakfastFields({
  guests,
  onGuestsChange,
  rate,
  onRateChange,
  inputClassName,
}: {
  guests: string;
  onGuestsChange: (guests: string) => void;
  rate: string;
  onRateChange: (rate: string) => void;
  inputClassName: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <label className="eyebrow text-cream/60 block mb-1">Breakfast guests</label>
        <input
          type="number"
          min={0}
          value={guests}
          onChange={(e) => onGuestsChange(e.target.value)}
          placeholder="none"
          className={inputClassName}
        />
      </div>
      <div className="flex-1">
        <label className="eyebrow text-cream/60 block mb-1">Rate per night</label>
        <select value={rate} onChange={(e) => onRateChange(e.target.value)} className={inputClassName}>
          <option value="">—</option>
          {BREAKFAST_RATES.map((r) => (
            <option key={r} value={r}>
              ฿{r}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
