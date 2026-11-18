import { describe, expect, it } from "vitest";
import { filenameFromDisposition } from "./bookingTrackerClient";

describe("filenameFromDisposition", () => {
  it("reads the name the server chose", () => {
    expect(filenameFromDisposition('attachment; filename="booking-tracker_2026-11_2027-04_2026-11-18.xlsx"')).toBe(
      "booking-tracker_2026-11_2027-04_2026-11-18.xlsx",
    );
    expect(filenameFromDisposition("attachment; filename=booking-tracker.xlsx")).toBe("booking-tracker.xlsx");
    expect(filenameFromDisposition("attachment; filename*=UTF-8''booking-tracker%20x.xlsx")).toBe("booking-tracker x.xlsx");
  });
  it("falls back to a plain name when there is none", () => {
    expect(filenameFromDisposition(null)).toBe("booking-tracker.xlsx");
    expect(filenameFromDisposition("attachment")).toBe("booking-tracker.xlsx");
  });
});
