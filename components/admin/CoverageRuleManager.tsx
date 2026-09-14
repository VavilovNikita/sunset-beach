"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setStaffAreaCoverageRule } from "@/lib/rosterClient";
import { STAFF_AREA_LABELS } from "@/lib/rosterGrid";
import type { StaffArea, StaffAreaCoverageRule } from "@/lib/types";

const STAFF_AREAS: StaffArea[] = ["ADMIN", "FRONT_OFFICE", "MAINTENANCE", "HOUSEKEEPING", "RESTAURANT", "KITCHEN"];

function Row({ area, rule, onSaved }: { area: StaffArea; rule: StaffAreaCoverageRule | undefined; onSaved: (r: StaffAreaCoverageRule) => void }) {
  const router = useRouter();
  const [value, setValue] = useState(rule?.minimumWorking ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = value !== (rule?.minimumWorking ?? 0);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    const result = await setStaffAreaCoverageRule(area, { minimumWorking: value });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.data);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-3">
      <p className="flex-1 font-display text-lg">{STAFF_AREA_LABELS[area]}</p>
      <label className="text-sm text-cream/60">Minimum working</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-20 bg-transparent border-b border-cream/25 py-1 text-cream text-sm text-center focus:outline-none focus:border-coral"
      />
      {dirty && (
        <button
          type="button"
          disabled={submitting}
          onClick={handleSave}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      )}
      {error && <p className="text-sm text-coral">{error}</p>}
      {rule && <p className="text-xs text-cream/40">set by {rule.updatedByEmail}</p>}
    </div>
  );
}

// One row per StaffArea, always - an area with no rule set shows 0 (never warns), matching
// GET /staff-area-coverage-rules' own "an area with no rule simply doesn't appear" contract:
// this manager is what turns "doesn't appear" into an explicit, editable zero.
export default function CoverageRuleManager({ initialRules }: { initialRules: StaffAreaCoverageRule[] }) {
  const [rules, setRules] = useState(initialRules);
  const byArea = new Map(rules.map((r) => [r.staffArea, r]));

  function handleSaved(r: StaffAreaCoverageRule) {
    setRules((prev) => [...prev.filter((x) => x.staffArea !== r.staffArea), r]);
  }

  return (
    <div className="max-w-2xl space-y-2">
      {STAFF_AREAS.map((area) => (
        <Row key={area} area={area} rule={byArea.get(area)} onSaved={handleSaved} />
      ))}
    </div>
  );
}
