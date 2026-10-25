"use client";

import { EXTEND_STAY_EVENT, EXTEND_STAY_HASH } from "@/lib/extendStay";

// "Extend the stay" in the overstay notice: opens the dates form in the Dates & room block with the departure already
// set to tomorrow (the guest sleeps here tonight) and scrolls to it - one click instead of scroll, "Change", edit.
// The form listens for the event (BookingScheduleForm); from another page the same thing is the link's #extend-stay.
export default function ExtendStayButton({ className }: { className?: string }) {
  return (
    <a
      href={`#${EXTEND_STAY_HASH}`}
      onClick={(e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(EXTEND_STAY_EVENT));
        document.getElementById("stay-dates")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className={
        className ??
        "inline-flex items-center rounded-full border border-coral/60 px-3 py-1 text-xs font-medium hover:bg-coral/10 transition-colors"
      }
    >
      Extend the stay
    </a>
  );
}
