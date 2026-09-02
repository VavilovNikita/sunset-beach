// Shared client-side calls for guest occupancy (POST /bookings/{id}/check-in,
// POST /bookings/{id}/check-out, POST /bookings/{id}/no-show) and the front desk's daily
// GET /bookings/today board. Mirrors lib/bookingRepriceClient.ts's exact pattern (same
// ok/error result shape, same adminRequest use).
import { adminRequest } from "@/lib/adminFetch";
import type { Booking, CheckInResult, CheckOutResult, TodayBoard } from "@/lib/types";

export type CheckInApiResult = { ok: true; result: CheckInResult } | { ok: false; error: string };
export type CheckOutApiResult = { ok: true; result: CheckOutResult } | { ok: false; error: string };
export type NoShowApiResult = { ok: true; booking: Booking } | { ok: false; error: string };
export type TodayBoardApiResult = { ok: true; board: TodayBoard } | { ok: false; error: string };

export async function checkInBooking(bookingId: string): Promise<CheckInApiResult> {
  const result = await adminRequest<CheckInResult>(`/bookings/${bookingId}/check-in`, { method: "POST" }, "Could not check in.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, result: result.data };
}

export async function checkOutBooking(bookingId: string): Promise<CheckOutApiResult> {
  const result = await adminRequest<CheckOutResult>(`/bookings/${bookingId}/check-out`, { method: "POST" }, "Could not check out.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, result: result.data };
}

export async function markBookingNoShow(bookingId: string): Promise<NoShowApiResult> {
  const result = await adminRequest<Booking>(`/bookings/${bookingId}/no-show`, { method: "POST" }, "Could not mark as no-show.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, booking: result.data };
}

export async function getTodayBoard(): Promise<TodayBoardApiResult> {
  const result = await adminRequest<TodayBoard>("/bookings/today", undefined, "Could not load today's board.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, board: result.data };
}
