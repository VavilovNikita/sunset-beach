"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEmployeePattern } from "@/lib/rosterClient";
import { STAFF_AREA_LABELS, WEEKDAY_LABELS } from "@/lib/rosterGrid";
import type { EmployeePattern, EmployeePatternInput, RosterEmployee, ShiftCode, StaffArea, Weekday } from "@/lib/types";

const STAFF_AREAS: StaffArea[] = ["ADMIN", "FRONT_OFFICE", "MAINTENANCE", "HOUSEKEEPING", "RESTAURANT", "KITCHEN"];
const WEEKDAYS: Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function EditRow({
  employee,
  pattern,
  shiftCodes,
  onSaved,
}: {
  employee: RosterEmployee;
  pattern: EmployeePattern | undefined;
  shiftCodes: ShiftCode[];
  onSaved: (p: EmployeePattern) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EmployeePatternInput>(
    pattern
      ? {
          staffArea: pattern.staffArea,
          defaultShiftCodeId: pattern.defaultShiftCodeId,
          workDaysPerWeek: pattern.workDaysPerWeek,
          weeklyDayOff: pattern.weeklyDayOff,
        }
      : { staffArea: "RESTAURANT", defaultShiftCodeId: null, workDaysPerWeek: 6, weeklyDayOff: "SUNDAY" }
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaCodes = shiftCodes.filter((c) => c.staffArea === form.staffArea && c.active);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    const result = await setEmployeePattern(employee.id, form);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.data);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-3">
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg truncate">{employee.name}</p>
          {pattern ? (
            <p className="text-sm text-cream/60">
              {STAFF_AREA_LABELS[pattern.staffArea]} · {pattern.workDaysPerWeek} days/week · off {WEEKDAY_LABELS[pattern.weeklyDayOff]}
              {pattern.defaultShiftCodeId
                ? ` · default ${shiftCodes.find((c) => c.id === pattern.defaultShiftCodeId)?.code ?? "—"}`
                : " · no default code"}
            </p>
          ) : (
            <p className="text-sm text-cream/40">No pattern set - generation will skip this employee.</p>
          )}
        </div>
        <button type="button" onClick={() => setEditing(true)} className="text-sm text-sea hover:text-coral transition-colors">
          {pattern ? "Edit" : "Set up"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
      <p className="font-display text-lg truncate">{employee.name}</p>
      <div className="grid sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Area</label>
          <select
            value={form.staffArea}
            onChange={(e) => setForm({ ...form, staffArea: e.target.value as StaffArea, defaultShiftCodeId: null })}
            className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
          >
            {STAFF_AREAS.map((a) => (
              <option key={a} value={a}>
                {STAFF_AREA_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Default code</label>
          <select
            value={form.defaultShiftCodeId ?? ""}
            onChange={(e) => setForm({ ...form, defaultShiftCodeId: e.target.value || null })}
            className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
          >
            <option value="">None</option>
            {areaCodes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Days/week</label>
          <input
            type="number"
            min={0}
            max={7}
            value={form.workDaysPerWeek}
            onChange={(e) => setForm({ ...form, workDaysPerWeek: Number(e.target.value) })}
            className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Weekly day off</label>
          <select
            value={form.weeklyDayOff}
            onChange={(e) => setForm({ ...form, weeklyDayOff: e.target.value as Weekday })}
            className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
          >
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={handleSave}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-sm text-cream/50 hover:text-cream transition-colors">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
    </div>
  );
}

export default function EmployeePatternManager({
  employees,
  initialPatterns,
  shiftCodes,
}: {
  employees: RosterEmployee[];
  initialPatterns: EmployeePattern[];
  shiftCodes: ShiftCode[];
}) {
  const [patterns, setPatterns] = useState(initialPatterns);
  const byEmployee = new Map(patterns.map((p) => [p.employeeUserId, p]));

  function handleSaved(p: EmployeePattern) {
    setPatterns((prev) => [...prev.filter((x) => x.employeeUserId !== p.employeeUserId), p]);
  }

  return (
    <div className="max-w-4xl space-y-2">
      {employees.length === 0 && <p className="text-cream/50 text-sm">No active employees.</p>}
      {employees.map((emp) => (
        <EditRow key={emp.id} employee={emp} pattern={byEmployee.get(emp.id)} shiftCodes={shiftCodes} onSaved={handleSaved} />
      ))}
    </div>
  );
}
