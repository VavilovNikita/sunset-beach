"use client";

import Link from "next/link";
import { toDateKey } from "@/lib/bookings";
import type { SpaMapTable } from "@/lib/posTypes";

// Side panel for one table clicked/tapped on the spa map - same shell as PropertyMapUnitPanel.tsx
// (no dimming backdrop, so the plan stays visible while looking at this table; click-outside
// closes). Unlike that panel, this one is read-only: there's no per-table action a spa table
// itself takes (no check-in/checkout/housekeeping equivalent) - working a treatment stays in the
// schedule grid, which is exactly what "Open in schedule" below leads to. Doesn't refetch its own
// data - the parent already has the full SpaMapTable from GET /spa-map.
export default function SpaTableMapPanel({ table, onClose }: { table: SpaMapTable; onClose: () => void }) {
  const today = toDateKey(new Date());

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div
        className="absolute top-0 right-0 bottom-0 w-full sm:w-[400px] bg-ink2 border-l border-cream/15 shadow-2xl pointer-events-auto overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-cream/10 flex items-center justify-between sticky top-0 bg-ink2 z-10">
          <p className="eyebrow text-sea">Spa table</p>
          <button onClick={onClose} className="text-cream/50 hover:text-cream transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <h2 className="font-display italic text-2xl mb-1">{table.label}</h2>
            <p className="text-sm text-cream/60">Seats {table.capacity}</p>
            {!table.isActive && <p className="text-sm text-cream/40 mt-1">Deactivated — not part of current inventory.</p>}
          </div>

          <div className="text-sm">
            {table.busy ? (
              <p className="text-cream/80">Busy right now.</p>
            ) : table.nextAppointmentStartTime ? (
              <p className="text-sea">Free — next at {table.nextAppointmentStartTime}.</p>
            ) : (
              <p className="text-sea">Free — nothing else today.</p>
            )}
          </div>

          <div>
            <p className="eyebrow text-cream/50 mb-2">Today&rsquo;s appointments{table.appointments.length > 0 ? ` (${table.appointments.length})` : ""}</p>
            {table.appointments.length === 0 ? (
              <p className="text-sm text-cream/40">Nothing booked on this table today.</p>
            ) : (
              <ul className="space-y-2">
                {table.appointments
                  .slice()
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((a) => (
                    <li key={a.id} className="text-sm border-b border-cream/5 pb-2 last:border-0 last:pb-0">
                      <p>
                        {a.startTime} · {a.guestName}
                      </p>
                      <p className="text-cream/50">
                        {a.treatmentNames.join(", ")} ({a.durationMinutes} min) · {a.status}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <Link
            href={`/admin/spa?date=${today}`}
            className="inline-block text-sm text-sea hover:text-coral transition-colors underline underline-offset-4"
          >
            Open in schedule →
          </Link>
        </div>
      </div>
    </div>
  );
}
