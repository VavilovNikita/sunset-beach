import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import { parseDateKey } from "@/lib/bookings";
import { hotelDateKey } from "@/lib/hotelDate";
import { visibleDays } from "@/lib/gymSchedule";
import GymScheduleGrid from "@/components/admin/GymScheduleGrid";
import type { GymSchedule } from "@/lib/types";

// A lone bad ?date= (hand-edited URL, a stale link) falls back to today rather than 500ing - the
// same "malformed param treated as absent" convention as the spa schedule's.
function parseDateParam(value: string | undefined): string {
  if (value) {
    try {
      parseDateKey(value);
      return value;
    } catch {
      // fall through to today
    }
  }
  return hotelDateKey(new Date());
}

// GET /gym/reservations is CASHIER+ on the backend, like the rest of the front-desk gym routes.
// The day or the week lives in the URL (?date=&view=day|week), so a reload or a shared link stays
// on it. Cancelled reservations are left out unless ?cancelled=1.
export default async function AdminGymSchedulePage({
  searchParams,
}: {
  searchParams: { date?: string; view?: string; cancelled?: string };
}) {
  const user = await requireRoleAtLeast("CASHIER");
  const date = parseDateParam(searchParams.date);
  const view = searchParams.view === "week" ? "week" : "day";
  const showCancelled = searchParams.cancelled === "1";
  const days = visibleDays(date, view);

  const schedule = await backendJson<GymSchedule>(
    `/gym/reservations?from=${days[0]}&to=${days[days.length - 1]}${showCancelled ? "&includeCancelled=true" : ""}`,
    { auth: true }
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <div>
          <p className="eyebrow text-sea mb-2">Front desk</p>
          <h1 className="font-display italic text-3xl">Gym schedule</h1>
        </div>
        <div className="flex items-center gap-4 mt-1 flex-wrap justify-end">
          <Link href="/admin/gym" className="text-sm text-sea hover:text-coral transition-colors underline underline-offset-4">
            Equipment
          </Link>
          {user.role === "ADMIN" && (
            <Link href="/admin/gym/settings" className="text-sm text-sea hover:text-coral transition-colors underline underline-offset-4">
              Hours &amp; automation settings
            </Link>
          )}
        </div>
      </div>
      <p className="text-sm text-cream/60 mb-6 max-w-3xl">
        One guest at a time — the gym is exclusive. Click a free slot to reserve it for a hotel booking, click a reservation to see what the
        equipment did, move it or cancel it. The fans and air conditioners are switched on before the start and off at the end by themselves.
      </p>
      <GymScheduleGrid schedule={schedule} date={date} view={view} showCancelled={showCancelled} />
    </div>
  );
}
