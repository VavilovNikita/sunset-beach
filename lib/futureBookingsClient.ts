import { extractApiError } from "@/lib/apiError";
import { ADMIN_API_URL } from "@/lib/backend";
import { filenameFromDisposition } from "@/lib/bookingTrackerClient";

export type CsvResult = { ok: true } | { ok: false; error: string };

// GET /reports/future-bookings/export, saved as a download. A failure comes back as text for the button's own error
// line (a plain link would have shown the browser a JSON error page instead).
export async function downloadFutureBookingsCsv(query: string): Promise<CsvResult> {
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}/reports/future-bookings/export?${query}`, { credentials: "include" });
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
    return { ok: false, error: extractApiError(body, "Could not export the bookings.") };
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromDisposition(res.headers.get("content-disposition")).replace(/\.xlsx$/, ".csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { ok: true };
}
