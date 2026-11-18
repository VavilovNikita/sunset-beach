// The booking tracker's writes and its export, through the admin proxy. The report itself is read server-side (the
// reports page) so only these need a client call.
import { adminJsonInit, adminRequest } from "@/lib/adminFetch";
import { extractApiError } from "@/lib/apiError";
import { ADMIN_API_URL } from "@/lib/backend";
import { trackerQuery, type TrackerParams } from "@/lib/bookingTracker";
import type {
  BookingTrackerMonthTargets,
  BookingTrackerMonthTargetsInput,
  BookingTrackerSnapshot,
  BookingTrackerSnapshotUpdateInput,
} from "@/lib/types";

export function saveMonthTargets(month: string, input: BookingTrackerMonthTargetsInput) {
  return adminRequest<BookingTrackerMonthTargets>(
    `/reports/booking-tracker/months/${month}`,
    adminJsonInit("PUT", input),
    "Could not save the target.",
  );
}

export function saveSnapshotNotes(id: string, patch: BookingTrackerSnapshotUpdateInput) {
  return adminRequest<BookingTrackerSnapshot>(
    `/reports/booking-tracker/snapshots/${encodeURIComponent(id)}`,
    adminJsonInit("PATCH", patch),
    "Could not save the notes.",
  );
}

// The file name the server chose (Content-Disposition), or a plain fallback.
export function filenameFromDisposition(header: string | null): string {
  const match = header ? /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header) : null;
  return match ? decodeURIComponent(match[1]) : "booking-tracker.xlsx";
}

export type ExportResult = { ok: true } | { ok: false; error: string };

// GET /reports/booking-tracker/export, saved as a download. A failure comes back as text for the button's own error line
// (a plain link would have shown the browser a JSON error page instead).
export async function downloadTrackerExport(params: TrackerParams): Promise<ExportResult> {
  const query = trackerQuery(params);
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}/reports/booking-tracker/export${query ? `?${query}` : ""}`, { credentials: "include" });
  } catch {
    return { ok: false, error: "No connection — check the network and try again." };
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // not JSON - the fallback below says what happened
    }
    return { ok: false, error: extractApiError(body, "Could not export the workbook.") };
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromDisposition(res.headers.get("content-disposition"));
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { ok: true };
}
