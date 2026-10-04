"use client";

import { cashTender } from "@/lib/cashTender";

// "Received from guest" + the change to hand back, shown before a CASH close is confirmed - on the
// desktop till and the phone alike (components/OrderTicket.tsx, shared by both).
// The total is the server's Order.total; see lib/cashTender.ts for why the change is the one
// figure worked out here and what the server does with the typed amount.
export default function CashTenderFields({
  total,
  value,
  onChange,
  inputClassName,
}: {
  total: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
}) {
  const tender = cashTender(total, value);
  return (
    <div className="space-y-2">
      <label className="eyebrow text-cream/60 block">Received from guest (฿)</label>
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // The total as a hint, styled so it can't pass for an amount already typed in.
        placeholder={`at least ${Number(total).toLocaleString("en-US")}`}
        className={`${inputClassName} placeholder:text-cream/25 placeholder:italic`}
      />
      {tender.ok ? (
        <p className="text-sm text-cream">
          Change to give: <span className="font-display italic text-xl text-coral">฿{Number(tender.change).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
        </p>
      ) : tender.reason === "insufficient" ? (
        <p className="text-sm text-amber-400">
          ฿{Number(tender.short).toLocaleString("en-US", { maximumFractionDigits: 2 })} short of the total — the cash received must cover it to close.
        </p>
      ) : (
        value.trim() !== "" ? (
          <p className="text-sm text-amber-400">Enter an amount like 500 or 500.50.</p>
        ) : (
          // Says why the close button is still disabled, before anyone wonders.
          <p className="text-sm text-cream/50">
            Enter the cash received — at least ฿{Number(total).toLocaleString("en-US", { maximumFractionDigits: 2 })} — to close the order.
          </p>
        )
      )}
    </div>
  );
}
