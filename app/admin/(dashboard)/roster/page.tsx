import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import RosterGrid from "@/components/admin/RosterGrid";
import RosterToolbar from "@/components/admin/RosterToolbar";
import ShiftCodeManager from "@/components/admin/ShiftCodeManager";
import EmployeePatternManager from "@/components/admin/EmployeePatternManager";
import CoverageRuleManager from "@/components/admin/CoverageRuleManager";
import AttendancePanel from "@/components/admin/AttendancePanel";
import PayRateManager from "@/components/admin/PayRateManager";
import type { EmployeePattern, RosterEmployee, RosterMonth, ShiftCode, StaffAreaCoverageRule } from "@/lib/types";

const TABS = [
  { key: "grid", label: "Grid" },
  { key: "codes", label: "Shift codes" },
  { key: "patterns", label: "Patterns" },
  { key: "coverage", label: "Coverage" },
  { key: "attendance", label: "Attendance" },
  { key: "payrates", label: "Pay rates" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function parseTab(raw: string | undefined): TabKey {
  return (TABS.find((t) => t.key === raw)?.key ?? "grid") as TabKey;
}

export default async function AdminRosterPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string; tab?: string };
}) {
  // Requires MANAGER or above on the backend for every read/write this page uses except
  // GET /roster/me (a different page - see app/admin/(dashboard)/schedule/page.tsx).
  const sessionUser = await requireRoleAtLeast("MANAGER");

  const now = new Date();
  const year = Number(searchParams.year) || now.getUTCFullYear();
  const month = Number(searchParams.month) || now.getUTCMonth() + 1;
  const tab = parseTab(searchParams.tab);

  const qs = (overrides: Partial<{ year: number; month: number; tab: TabKey }>) => {
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
          <RosterToolbar year={year} month={month} isAdmin={sessionUser.role === "ADMIN"} />
        </div>
        <p className="print:hidden text-xs text-cream/40 mb-4 max-w-2xl">
          Drag a shift onto an empty day for the same person to move it, onto an empty day for someone else to give it to
          them, or onto another person&rsquo;s shift to swap. Click an empty day to assign a shift; click a shift to lock,
          unlock, or remove it. A coral coverage figure means that area is below its minimum that day - a warning, not a
          block.
        </p>
        <RosterGrid data={rosterMonth} year={year} month={month} shiftCodes={shiftCodes} isAdmin={sessionUser.role === "ADMIN"} />
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
  } else if (tab === "attendance") {
    const employees = await backendJson<RosterEmployee[]>("/roster/employees", { auth: true });
    content = <AttendancePanel employees={employees} />;
  } else {
    const employees = await backendJson<RosterEmployee[]>("/roster/employees", { auth: true });
    content = <PayRateManager employees={employees} />;
  }

  return (
    <div>
      <p className="print:hidden eyebrow text-sea mb-2">Staff</p>
      <h1 className="print:hidden font-display italic text-3xl mb-6">Roster</h1>

      <div className="print:hidden flex gap-1 border-b border-cream/10 mb-6">
        {TABS.map((t) => (
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
