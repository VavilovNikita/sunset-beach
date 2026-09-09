"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysUTC, dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { buildSlotColumns, slotIndexOf, slotSpanOf } from "@/lib/spaGridLayout";
import SpaAppointmentCreateModal from "@/components/admin/SpaAppointmentCreateModal";
import SpaAppointmentPanel from "@/components/admin/SpaAppointmentPanel";
import type { MenuItem, SpaAppointment, SpaSchedule, SpaTherapist } from "@/lib/posTypes";
import type { Booking } from "@/lib/types";

const COL_WIDTH = 64;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 160;

// BOOKED/COMPLETED are the two "something is actually happening here" states and block the
// slot's click target below; CANCELLED/NO_SHOW still render (a receptionist working the grid
// needs to see a cancellation happened, not have it vanish) but never occupy a cell - see
// SpaSchedule's own backend description ("a cancelled/no-show slot still needs to render, just
// not as occupied").
const OCCUPYING_STATUSES = new Set<SpaAppointment["status"]>(["BOOKED", "COMPLETED"]);

const STATUS_STYLES: Record<SpaAppointment["status"], string> = {
  BOOKED: "bg-sea text-ink",
  COMPLETED: "bg-green-600 text-cream",
  CANCELLED: "bg-cream/10 text-cream/40 line-through",
  NO_SHOW: "bg-coral/15 text-coral/70 line-through",
};

export default function SpaScheduleGrid({
  schedule,
  menuItems,
  bookings,
  therapists,
  date,
}: {
  schedule: SpaSchedule;
  menuItems: MenuItem[];
  bookings: Booking[];
  therapists: SpaTherapist[];
  date: string;
}) {
  const router = useRouter();
  const columns = buildSlotColumns(schedule.openingTime, schedule.closingTime, schedule.slotMinutes);
  const [createTarget, setCreateTarget] = useState<{ tableId: string; tableLabel: string; startTime: string } | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const appointmentsByTable = new Map<string, SpaAppointment[]>();
  for (const a of schedule.appointments) {
    const list = appointmentsByTable.get(a.tableId) ?? [];
    list.push(a);
    appointmentsByTable.set(a.tableId, list);
  }

  function goToDate(next: string) {
    router.push(`/admin/spa?date=${next}`);
  }

  const selectedAppointment = schedule.appointments.find((a) => a.id === selectedAppointmentId) ?? null;
  const treatments = menuItems.filter((m) => m.department === "SPA" && m.durationMinutes != null);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => goToDate(toDateKey(addDaysUTC(dateOnlyUTC(date), -1)))}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-sm"
        >
          ← Prev day
        </button>
        <span className="text-sm text-cream/70 font-medium">{date}</span>
        <button
          type="button"
          onClick={() => goToDate(toDateKey(addDaysUTC(dateOnlyUTC(date), 1)))}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-sm"
        >
          Next day →
        </button>
      </div>

      {schedule.tables.length === 0 ? (
        <p className="text-sm text-cream/40 bg-ink2/40 border border-cream/10 rounded-xl px-4 py-3">
          No active tables in the SPA zone yet.
        </p>
      ) : (
        <div className="overflow-auto border border-cream/10 rounded-xl">
          <div style={{ width: LABEL_WIDTH + columns.length * COL_WIDTH }}>
            <div className="flex sticky top-0 z-20 bg-ink2 border-b border-cream/10">
              <div className="sticky left-0 z-30 bg-ink2 shrink-0" style={{ width: LABEL_WIDTH }} />
              {columns.map((c) => (
                <div
                  key={c}
                  className="shrink-0 text-center text-[10px] text-cream/40 py-1.5 border-r border-cream/5"
                  style={{ width: COL_WIDTH }}
                >
                  {c}
                </div>
              ))}
            </div>

            {schedule.tables.map((table) => {
              const appts = appointmentsByTable.get(table.id) ?? [];
              const occupiedCols = new Set<number>();
              for (const a of appts) {
                if (!OCCUPYING_STATUSES.has(a.status)) continue;
                const start = slotIndexOf(a.startTime, schedule.openingTime, schedule.slotMinutes);
                const span = slotSpanOf(a.durationMinutes, schedule.slotMinutes);
                for (let i = start; i < start + span; i++) occupiedCols.add(i);
              }

              return (
                <div key={table.id} className="flex border-b border-cream/5 relative" style={{ height: ROW_HEIGHT }}>
                  <div
                    className="sticky left-0 z-10 bg-ink shrink-0 flex items-center px-3 text-sm text-cream/80 truncate"
                    style={{ width: LABEL_WIDTH }}
                    title={table.label}
                  >
                    {table.label}
                  </div>
                  <div className="relative shrink-0" style={{ width: columns.length * COL_WIDTH, height: ROW_HEIGHT }}>
                    {columns.map((c, i) => (
                      <button
                        key={c}
                        type="button"
                        disabled={occupiedCols.has(i)}
                        onClick={() => setCreateTarget({ tableId: table.id, tableLabel: table.label, startTime: c })}
                        className={`absolute top-0 bottom-0 border-r border-cream/5 ${
                          occupiedCols.has(i) ? "" : "hover:bg-cream/5 cursor-cell"
                        }`}
                        style={{ left: i * COL_WIDTH, width: COL_WIDTH }}
                        aria-label={`Book ${table.label} at ${c}`}
                      />
                    ))}

                    {appts.map((a) => {
                      const start = slotIndexOf(a.startTime, schedule.openingTime, schedule.slotMinutes);
                      const span = slotSpanOf(a.durationMinutes, schedule.slotMinutes);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedAppointmentId(a.id)}
                          className={`absolute rounded-md flex items-center gap-1 px-2 text-xs truncate pointer-events-auto ${STATUS_STYLES[a.status]}`}
                          style={{ left: start * COL_WIDTH + 2, width: span * COL_WIDTH - 4, top: 3, height: ROW_HEIGHT - 6 }}
                          title={`${a.guestName} · ${a.treatmentName} · ${a.status}`}
                        >
                          <span className="truncate">{a.guestName}</span>
                          {a.status === "COMPLETED" && !a.orderId && <span title="Not yet charged">⚠</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {createTarget && (
        <SpaAppointmentCreateModal
          date={date}
          tableId={createTarget.tableId}
          tableLabel={createTarget.tableLabel}
          startTime={createTarget.startTime}
          bookings={bookings}
          therapists={therapists}
          treatments={treatments}
          onClose={() => setCreateTarget(null)}
          onCreated={() => {
            setCreateTarget(null);
            router.refresh();
          }}
        />
      )}

      {selectedAppointment && (
        <SpaAppointmentPanel
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointmentId(null)}
          onUpdated={() => {
            setSelectedAppointmentId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
