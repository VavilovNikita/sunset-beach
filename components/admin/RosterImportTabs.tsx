"use client";

import { useState } from "react";
import RosterImportManager from "@/components/admin/RosterImportManager";
import RosterGridImportManager from "@/components/admin/RosterGridImportManager";
import type { EmployeeOption } from "@/components/admin/RosterImportManager";

// Two genuinely different file shapes, not two settings on one form - the hand-built schedule
// (RosterImportManager) has no export metadata to lean on and resolves everything by name/colour
// text; the grid re-import (RosterGridImportManager) reads a file this app produced itself via
// GET /roster/export and resolves positionally instead. An explicit tab, rather than guessing the
// shape from the uploaded file, since telling them apart client-side would mean parsing the
// workbook's own XML before ever calling the backend - not worth it when the admin already knows
// which file they're holding.
export default function RosterImportTabs({ initialEmployees }: { initialEmployees: EmployeeOption[] }) {
  const [tab, setTab] = useState<"legacy" | "grid">("legacy");

  return (
    <div>
      <div className="flex text-sm rounded-full border border-cream/20 overflow-hidden w-fit mb-6">
        <button
          type="button"
          onClick={() => setTab("legacy")}
          className={`px-4 py-2 transition-colors ${tab === "legacy" ? "bg-coral text-ink" : "text-cream/60 hover:text-cream"}`}
        >
          Hand-built schedule
        </button>
        <button
          type="button"
          onClick={() => setTab("grid")}
          className={`px-4 py-2 transition-colors ${tab === "grid" ? "bg-coral text-ink" : "text-cream/60 hover:text-cream"}`}
        >
          Re-import a grid export
        </button>
      </div>

      {tab === "legacy" ? (
        <>
          <p className="text-sm text-cream/60 mb-6 max-w-2xl">
            Reads the hand-built Excel schedule for one month and turns it into roster entries. Nothing is written
            until every name below maps to an account and every ambiguous &ldquo;9&rdquo; maps to a shift code -
            read the file, resolve what&rsquo;s unresolved, then confirm.
          </p>
          <RosterImportManager initialEmployees={initialEmployees} />
        </>
      ) : (
        <>
          <p className="text-sm text-cream/60 mb-6 max-w-2xl">
            Re-imports a file this app&rsquo;s own <span className="text-cream/80">Export</span> button produced -
            restoring or syncing a month&rsquo;s schedule from it. Only cells that actually differ from what&rsquo;s
            in the roster right now are touched; a <span className="text-cream/80">locked</span> entry is never
            overwritten.
          </p>
          <RosterGridImportManager initialEmployees={initialEmployees} />
        </>
      )}
    </div>
  );
}
