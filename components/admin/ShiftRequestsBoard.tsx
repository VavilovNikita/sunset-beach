"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";
import HrVacationForm from "@/components/admin/HrVacationForm";
import { decideShiftRequest, fetchShiftRequests } from "@/lib/shiftRequestClient";
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  coverageSentences,
  decisionCommentError,
  decisionLine,
  decidersSummary,
  defaultRequestFilters,
  requestFiltersError,
  requestHeadline,
  requestStatusClass,
  showDecisionButtons,
  type RequestFilters,
} from "@/lib/shiftRequests";
import { STAFF_AREA_LABELS } from "@/lib/rosterGrid";
import { formatTimestamp } from "@/lib/formatDate";
import type { ShiftChangeRequest, ShiftChangeRequestStatus, ShiftRequestDeciders } from "@/lib/types";

const INPUT = "bg-ink border border-cream/20 rounded-lg px-3 py-2 min-h-[44px] text-sm";

type Pending = { request: ShiftChangeRequest; decision: "APPROVE" | "REJECT" } | null;

// Employees' requests to move a shift or take a day off, filed in the staff Telegram bot. Approve and Reject
// appear only for someone who is one of today's deciders (the server says so per request, callerMayDecide); a
// MANAGER+ who is not one sees the same list without buttons. Approving applies the change through the roster's
// own code on the server - and if the entry changed since the request, nothing is applied and the card shows
// "Expired" with the reason, which is what the decider is told, not an error.
export default function ShiftRequestsBoard({
  initialRequests,
  initialFilters,
  initialDeciders,
  canSetLeave,
  highlightId,
}: {
  initialRequests: ShiftChangeRequest[];
  initialFilters: RequestFilters;
  initialDeciders: ShiftRequestDeciders;
  // The HR holder (for themselves) or an administrator.
  canSetLeave: boolean;
  highlightId?: string;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [filters, setFilters] = useState<RequestFilters>(initialFilters);
  const [deciders, setDeciders] = useState(initialDeciders);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [comment, setComment] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);
  const highlightRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const filtersError = requestFiltersError(filters);

  async function load(next: RequestFilters) {
    setLoading(true);
    setLoadError(null);
    const result = await fetchShiftRequests(next);
    setLoading(false);
    if (!result.ok) {
      // The previous rows stay, but they are not the ones asked for - say so.
      setLoadError(`${result.error} The list below is from before.`);
      return;
    }
    setRequests(result.data);
  }

  function applyFilters(next: RequestFilters) {
    setFilters(next);
    if (!requestFiltersError(next)) load(next);
  }

  function replace(updated: ShiftChangeRequest) {
    setRequests((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function decide(): Promise<string | null> {
    if (!pending) return null;
    const result = await decideShiftRequest(pending.request.id, {
      decision: pending.decision,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    if (!result.ok) return result.error;
    replace(result.data);
    const wanted: ShiftChangeRequestStatus = pending.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    setOutcome(
      result.data.status === wanted
        ? null
        : result.data.status === "EXPIRED"
          ? `Nothing was changed: ${result.data.expiredReason ?? "the request expired."}`
          : `Already ${REQUEST_STATUS_LABELS[result.data.status].toLowerCase()} - nothing was changed.`
    );
    return null;
  }

  const commentProblem = decisionCommentError(comment);

  return (
    <div>
      <div className="rounded-xl border border-cream/10 bg-ink2/50 p-4 mb-6">
        <p className="text-sm text-cream/80">{decidersSummary(deciders)}</p>
        {!deciders.callerMayDecide && <p className="text-xs text-cream/50 mt-1">You can read the requests but are not one of today&rsquo;s deciders.</p>}
        {canSetLeave && (
          <div className="mt-4">
            <HrVacationForm deciders={deciders} onSaved={setDeciders} />
          </div>
        )}
      </div>

      <form
        className="flex flex-wrap items-end gap-3 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!filtersError) load(filters);
        }}
      >
        <label className="text-sm">
          <span className="block text-cream/60 mb-1">Status</span>
          <select value={filters.status} onChange={(e) => applyFilters({ ...filters, status: e.target.value as ShiftChangeRequestStatus | "" })} className={INPUT}>
            <option value="">All</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {REQUEST_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-cream/60 mb-1">Shift from</span>
          <input type="date" value={filters.from} onChange={(e) => applyFilters({ ...filters, from: e.target.value })} className={INPUT} />
        </label>
        <label className="text-sm">
          <span className="block text-cream/60 mb-1">Shift to</span>
          <input type="date" value={filters.to} onChange={(e) => applyFilters({ ...filters, to: e.target.value })} className={INPUT} />
        </label>
        <button
          type="button"
          onClick={() => applyFilters(defaultRequestFilters())}
          className="min-h-[44px] px-2 text-sm text-cream/60 hover:text-cream transition-colors"
        >
          Reset
        </button>
        <button type="submit" disabled={loading || filtersError !== null} className="min-h-[44px] rounded-full bg-cream/10 hover:bg-cream/20 transition-colors px-5 text-sm disabled:opacity-60">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </form>
      {filtersError && <p className="text-sm text-coral mb-3">{filtersError}</p>}
      {loadError && <p className="text-sm text-coral mb-3">{loadError}</p>}
      {outcome && <p className="text-sm text-amber-400 mb-3">{outcome}</p>}

      {requests.length === 0 ? (
        <p className="text-cream/60 text-sm">No requests match.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const coverage = coverageSentences(r.coverage, (area) => STAFF_AREA_LABELS[area]);
            const settled = decisionLine(r, formatTimestamp);
            const highlighted = r.id === highlightId;
            return (
              <li
                key={r.id}
                ref={highlighted ? highlightRef : undefined}
                className={`rounded-xl border bg-ink2/50 p-4 ${highlighted ? "border-sea" : "border-cream/10"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-cream">{r.employeeName}</p>
                    <p className="text-sm text-cream/70">
                      <span className="eyebrow text-cream/50 mr-2">{REQUEST_TYPE_LABELS[r.type]}</span>
                      {requestHeadline(r)}
                    </p>
                  </div>
                  <span className={`text-xs border rounded-full px-2.5 py-0.5 ${requestStatusClass(r.status)}`}>{REQUEST_STATUS_LABELS[r.status]}</span>
                </div>
                {r.reason && <p className="text-sm text-cream/80 mt-2">“{r.reason}”</p>}
                {coverage.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {coverage.map((c, n) => (
                      <li key={n} className={`text-xs ${c.warn ? "text-coral" : "text-cream/60"}`}>
                        {c.warn && <span aria-hidden="true">▲ </span>}
                        {c.text}
                        {c.warn && <span className="sr-only"> (below the minimum)</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-cream/40 mt-2">
                  Filed {formatTimestamp(r.createdAt)} · {r.channel === "TELEGRAM" ? "Telegram" : "Admin"}
                  {settled && <> · {settled}</>}
                  {r.decisionComment && <> · “{r.decisionComment}”</>}
                </p>
                {showDecisionButtons(r) && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setComment("");
                        setOutcome(null);
                        setPending({ request: r, decision: "APPROVE" });
                      }}
                      className="min-h-[44px] rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComment("");
                        setOutcome(null);
                        setPending({ request: r, decision: "REJECT" });
                      }}
                      className="min-h-[44px] rounded-full bg-cream/10 hover:bg-cream/20 transition-colors px-5 text-sm"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-cream/40 mt-6">
        Approving applies the change in the roster. See the{" "}
        <Link href="/admin/roster" className="text-sea hover:text-coral transition-colors underline underline-offset-4">
          roster
        </Link>{" "}
        for the grid; a shift with a waiting request carries a small clock mark there.
      </p>

      {pending && (
        <ConfirmActionDialog
          eyebrow={pending.decision === "APPROVE" ? "Approve request" : "Reject request"}
          title={`${pending.request.employeeName}: ${requestHeadline(pending.request)}`}
          confirmLabel={pending.decision === "APPROVE" ? "Approve" : "Reject"}
          busyLabel="Saving…"
          action={async () => (commentProblem ? commentProblem : decide())}
          onDone={() => setPending(null)}
          onBack={() => setPending(null)}
        >
          <label className="block text-sm">
            <span className="block text-cream/60 mb-1">Comment for the employee (optional)</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
            />
            {commentProblem && <span className="text-xs text-coral">{commentProblem}</span>}
          </label>
          {pending.decision === "APPROVE" && (
            <p className="text-xs text-cream/50">
              {pending.request.type === "DELETE" ? "The shift is removed from the roster." : "The shift moves to the new day."} If the shift was changed
              since the request, nothing is applied.
            </p>
          )}
          {pending.request.coverage?.belowMinimum && <p className="text-xs text-coral">▲ The department would be below its minimum - a warning, not a block.</p>}
        </ConfirmActionDialog>
      )}
    </div>
  );
}
