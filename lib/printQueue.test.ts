import { describe, expect, it } from "vitest";
import {
  emptyPrintQueueText,
  jobMatchesFilter,
  mergePrintJobLists,
  notPrintedBannerText,
  statusesForFilter,
  summarizeNotPrinted,
} from "./printQueue";
import type { PrintJob } from "@/lib/posTypes";

function job(overrides: Partial<PrintJob>): PrintJob {
  return {
    id: "j1",
    printerId: "p1",
    documentType: "KITCHEN_TICKET",
    summary: "Kitchen ticket",
    status: "PENDING",
    attempts: 1,
    lastError: "Connect timed out",
    createdAt: "2026-10-03T14:05:00Z",
    updatedAt: "2026-10-03T14:06:00Z",
    dismissedAt: null,
    dismissedByUserId: null,
    dismissNote: null,
    ...overrides,
  };
}

describe("summarizeNotPrinted", () => {
  // The bug: a ticket still retrying (PENDING, 3 attempts) was invisible to both counters for
  // ~4 minutes, then appeared on whichever one was looked at next.
  it("counts a job that is still retrying as not printed", () => {
    expect(summarizeNotPrinted([job({ status: "PENDING", attempts: 3 })])).toEqual({ total: 1, retrying: 1 });
  });

  it("counts FAILED and PENDING together, SENT never", () => {
    const jobs = [job({ id: "a", status: "FAILED" }), job({ id: "b", status: "PENDING" }), job({ id: "c", status: "SENT" })];
    expect(summarizeNotPrinted(jobs)).toEqual({ total: 2, retrying: 1 });
  });

  it("leaves dismissed jobs out", () => {
    expect(summarizeNotPrinted([job({ status: "FAILED", dismissedAt: "2026-10-03T15:00:00Z" })])).toEqual({ total: 0, retrying: 0 });
  });
});

describe("filters", () => {
  it("fetches FAILED and PENDING for Not printed, nothing extra for All", () => {
    expect(statusesForFilter("NOT_PRINTED")).toEqual(["FAILED", "PENDING"]);
    expect(statusesForFilter("SENT")).toEqual(["SENT"]);
    expect(statusesForFilter("")).toEqual([undefined]);
  });

  it("a retried job that printed drops out of Not printed", () => {
    expect(jobMatchesFilter(job({ status: "SENT" }), "NOT_PRINTED")).toBe(false);
    expect(jobMatchesFilter(job({ status: "FAILED" }), "NOT_PRINTED")).toBe(true);
    expect(jobMatchesFilter(job({ status: "SENT" }), "")).toBe(true);
  });
});

describe("mergePrintJobLists", () => {
  it("keeps one row per job and orders newest first", () => {
    const older = job({ id: "a", createdAt: "2026-10-03T10:00:00Z" });
    const newer = job({ id: "b", createdAt: "2026-10-03T12:00:00Z" });
    // Moved PENDING -> FAILED between the two requests: seen in both lists.
    const moved = job({ id: "a", status: "FAILED", createdAt: "2026-10-03T10:00:00Z" });
    expect(mergePrintJobLists([[older, newer], [moved]]).map((j) => [j.id, j.status])).toEqual([
      ["b", "PENDING"],
      ["a", "FAILED"],
    ]);
  });
});

describe("text", () => {
  it("says how many are still retrying", () => {
    expect(notPrintedBannerText({ total: 3, retrying: 2 })).toBe(
      "3 print jobs not printed (2 still retrying) — a ticket may not have reached the kitchen/bar"
    );
    expect(notPrintedBannerText({ total: 1, retrying: 0 })).toBe(
      "1 print job not printed — a ticket may not have reached the kitchen/bar"
    );
  });

  it("names the filter in the empty state", () => {
    expect(emptyPrintQueueText("FAILED")).toBe("No print jobs with status failed.");
    expect(emptyPrintQueueText("")).toBe("No print jobs.");
  });
});
