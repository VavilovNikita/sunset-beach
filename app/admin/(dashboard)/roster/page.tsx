import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeastOrFunction } from "@/lib/rbac";
import { canEditRoster, parseRosterTab, visibleRosterTabs } from "@/lib/rosterAccess";
import RosterGrid from "@/components/admin/RosterGrid";
import RosterToolbar from "@/components/admin/RosterToolbar";
import ShiftCodeManager from "@/components/admin/ShiftCodeManager";
import EmployeePatternManager from "@/components/admin/EmployeePatternManager";
import CoverageRuleManager from "@/components/admin/CoverageRuleManager";
import AttendancePanel from "@/components/admin/AttendancePanel";
import TodayShiftBoard from "@/components/admin/TodayShiftBoard";
import PayRateManager from "@/components/admin/PayRateManager";
import type { EmployeePattern, RosterEmployee, RosterMonth, ServerTime, ShiftCode, StaffAreaCoverageRule, TodayShiftStatus } from "@/lib/types";
import { hotelYearMonth } from "@/lib/hotelDate";
import type { RosterTabKey } from "@/lib/rosterAccess";

// Same "slice the ISO string, don't reformat through Date" convention TodayShiftBoard's own
// timeLabel already uses - `serverTime.now` is already the backend clock's own zone, so parsing
// it through a Date here would re-interpret it through this server's own ambient zone, exactly
// the ambient-zone dependence this diagnostic exists to avoid.
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatServerTime(serverTime: ServerTime): string {
  const [year, month, day] = serverTime.now.slice(0, 10).split("-");
  const time = serverTime.now.slice(11, 16);
  return `${Number(day)} ${MONTH_LABELS[Number(month) - 1]} ${year}, ${time} (${serverTime.zone})`;
}

export default async function AdminRosterPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string; tab?: string };
}) {
  // MANAGER or above for every tab. The HR director (the HR job function, below MANAGER) may open the grid and the
  // attendance summary - the backend lets them READ GET /roster, /roster/employees and /attendance/summary and
  // nothing else here - so for them the page is read only and shows just those two tabs (lib/rosterAccess.ts).
  // GET /roster/me is a different page - see app/admin/(dashboard)/schedule/page.tsx.
  const sessionUser = await requireRoleAtLeastOrFunction("MANAGER", "HR");
  const canEdit = canEditRoster(sessionUser.role);
  const tabs = visibleRosterTabs(sessionUser.role);

  const current = hotelYearMonth(new Date());
  const year = Number(searchParams.year) || current.year;
  const month = Number(searchParams.month) || current.month;
  const tab = parseRosterTab(searchParams.tab, sessionUser.role);

  const qs = (overrides: Partial<{ year: number; month: number; tab: RosterTabKey }>) => {
    const next = { year, month, tab, ...overrides };
    return `/admin/roster?year=${next.year}&month=${next.month}&tab=${next.tab}`;
  };

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  let content: React.ReactNode;
  if (tab === "grid") {
    const [rosterMonth, shiftCodes] = await Promise.all([
      backendJson<RosterMonth>(`/roster?year=${year}&month=${month}`, { auth: true }),
      backendJson<ShiftCode[]>("/shift-codes", { auth: true }),
    ]);
    content = (
      <>
        <p className="hidden print:block font-display italic text-2xl mb-4">
          Roster — {year}-{String(month).padStart(2, "0")}
        </p>
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Link href={qs(prevMonth)} className="text-sm text-sea hover:text-coral transition-colors">
              ← Prev
            </Link>
            <p className="text-sm text-cream/70 tabular-nums">
              {year}-{String(month).padStart(2, "0")}
            </p>
            <Link href={qs(nextMonth)} className="text-sm text-sea hover:text-coral transition-colors">
              Next →
            </Link>
          </div>
          {canEdit && <RosterToolbar year={year} month={month} isAdmin={sessionUser.role === "ADMIN"} />}
        </div>
        <p className="print:hidden text-xs text-cream/40 mb-4 max-w-2xl">
          {canEdit
            ? "Drag a shift onto an empty day for the same person to move it, onto an empty day for someone else to give it to them, or onto another person’s shift to swap. Click an empty day to assign a shift; click a shift to lock, unlock, or remove it. A coral coverage figure means that area is below its minimum that day - a warning, not a block."
            : "Read only: you can see the schedule and the waiting shift requests, not change it. A coral coverage figure means that area is below its minimum that day - a warning, not a block."}
        </p>
        <RosterGrid data={rosterMonth} year={year} month={month} shiftCodes={shiftCodes} isAdmin={sessionUser.role === "ADMIN"} readOnly={!canEdit} />
      </>
    );
  } else if (tab === "codes") {
    const shiftCodes = await backendJson<ShiftCode[]>("/shift-codes", { auth: true });
    content = <ShiftCodeManager initialCodes={shiftCodes} />;
  } else if (tab === "patterns") {
    const [employees, patterns, shiftCodes] = await Promise.all([
      backendJson<RosterEmployee[]>("/roster/employees", { auth: true }),
      backendJson<EmployeePattern[]>("/employee-patterns", { auth: true }),
      backendJson<ShiftCode[]>("/shift-codes", { auth: true }),
    ]);
    content = <EmployeePatternManager employees={employees} initialPatterns={patterns} shiftCodes={shiftCodes} />;
  } else if (tab === "coverage") {
    const rules = await backendJson<StaffAreaCoverageRule[]>("/staff-area-coverage-rules", { auth: true });
    content = <CoverageRuleManager initialRules={rules} />;
  } else if (tab === "today") {
    const [statuses, serverTime] = await Promise.all([
      backendJson<TodayShiftStatus[]>("/attendance/today", { auth: true }),
      backendJson<ServerTime>("/attendance/server-time", { auth: true }),
    ]);
    content = (
      <>
        <p className="text-xs text-cream/40 mb-4">Server time: {formatServerTime(serverTime)}</p>
        <TodayShiftBoard initialStatuses={statuses} />
      </>
    );
  } else if (tab === "attendance") {
    const employees = await backendJson<RosterEmployee[]>("/roster/employees", { auth: true });
    content = <AttendancePanel employees={employees} readOnly={!canEdit} />;
  } else {
    const employees = await backendJson<RosterEmployee[]>("/roster/employees", { auth: true });
    content = <PayRateManager employees={employees} />;
  }

  return (
    <div>
      <p className="print:hidden eyebrow text-sea mb-2">Staff</p>
      <h1 className="print:hidden font-display italic text-3xl mb-6">Roster</h1>

      <div className="print:hidden flex gap-1 border-b border-cream/10 mb-6">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={qs({ tab: t.key })}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              tab === t.key ? "bg-ink2 text-coral" : "text-cream/60 hover:text-cream"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {content}
    </div>
  );
}
