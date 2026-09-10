"use client";

import { useRouter } from "next/navigation";
import GuestLinkEditor from "@/components/admin/GuestLinkEditor";
import type { Booking } from "@/lib/types";

// Thin client wrapper so the (server) booking detail page can drop GuestLinkEditor in without
// itself needing state - same router.refresh()-after-save pattern as BookingScheduleForm/
// BookingStatusForm on that page.
export default function BookingGuestLinkSection({ booking }: { booking: Booking }) {
  const router = useRouter();
  return <GuestLinkEditor booking={booking} onSaved={() => router.refresh()} />;
}
