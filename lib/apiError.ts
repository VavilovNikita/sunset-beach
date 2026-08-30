// Shared error-message extraction for admin-proxy responses. The backend explains a rejected
// request in plain text (e.g. "Room 5 is blocked (under renovation)...") or, for Zod-flatten-style
// validation failures, as { formErrors, fieldErrors } — either way, surface that text as-is rather
// than a generic "something went wrong" that would hide the actual reason. Mirrors the pattern
// already duplicated slightly differently in BookingRoomUnitAssign.tsx/AvailabilityManager.tsx;
// pulled out here since the booking calendar grid, its create-booking modal, and the booking
// detail page's schedule form all need the exact same handling for the new schedule endpoints.
export function extractApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object" || !("error" in data)) return fallback;
  const err = (data as { error: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const { formErrors, fieldErrors } = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const messages = [...(formErrors ?? []), ...Object.values(fieldErrors ?? {}).flat()];
    if (messages.length > 0) return messages.join(" ");
  }
  return fallback;
}
