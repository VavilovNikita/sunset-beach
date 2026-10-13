// Client-side calls for the gym schedule (components/admin/GymSchedule*.tsx) and the ADMIN hall
// settings. Every call goes through adminRequest, so a failure is the backend's own plain message
// next to the control that asked ("The gym is already booked for part of that time.", ...).
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { addDaysToDateKey } from "@/lib/hotelDate";
import type {
  Booking,
  GymHallSettings,
  GymHallSettingsResult,
  GymReservation,
  GymReservationCreateInput,
  GymReservationScheduleInput,
} from "@/lib/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(path: string, init: RequestInit | undefined, fallback: string): Promise<Result<T>> {
  const result = await adminRequest<T>(path, init, fallback);
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
}

export function createGymReservation(input: GymReservationCreateInput) {
  return call<GymReservation>("/gym/reservations", adminJsonInit("POST", input), "Could not reserve the gym.");
}

// Full replacement of date / startTime / durationMinutes. Once the equipment has been switched on
// for a reservation only its length can change (the backend says so with a 409).
export function moveGymReservation(id: string, input: GymReservationScheduleInput) {
  return call<GymReservation>(`/gym/reservations/${id}/schedule`, adminJsonInit("PATCH", input), "Could not move the reservation.");
}

export function cancelGymReservation(id: string, reason?: string) {
  return call<GymReservation>(
    `/gym/reservations/${id}/cancel`,
    adminJsonInit("POST", reason && reason.trim() ? { reason: reason.trim() } : {}),
    "Could not cancel the reservation."
  );
}

// Hotel bookings whose stay covers `date` (the departure day included). GET /bookings?from&to is
// `checkOut > from AND checkIn <= to`, so from = the day before. Which of them can actually be
// booked into the gym is the server's call; the picker only hides the ones that never can.
export async function loadBookingsForDate(date: string): Promise<Result<Booking[]>> {
  const result = await call<Booking[]>(`/bookings?from=${addDaysToDateKey(date, -1)}&to=${date}`, undefined, "Could not load the bookings.");
  if (!result.ok) return result;
  // The stay itself must cover the date (departure day included): a guest still checked in past their check-out date is listed by
  // the endpoint (they hold the room) but the gym cannot be booked outside the stay - the server answers 400.
  return {
    ok: true,
    data: result.data.filter(
      (b) =>
        b.status !== "CANCELLED" &&
        (b.occupancyStatus === "CHECKED_IN" || b.occupancyStatus === "EXPECTED") &&
        b.checkIn <= date &&
        date <= b.checkOut
    ),
  };
}

// ---- hall settings (ADMIN) ----

export function loadGymHallSettings() {
  return call<GymHallSettings>("/gym/settings/hall", undefined, "Could not load the gym settings.");
}

// Without `force`, hours that would leave future reservations outside them are not saved: the answer has
// saved=false and the reservations, for the owner to confirm (then the same call with force=true).
export function saveGymHallSettings(input: GymHallSettings, force = false) {
  return call<GymHallSettingsResult>(`/gym/settings/hall${force ? "?force=true" : ""}`, adminJsonInit("PUT", input), "Could not save the gym settings.");
}
