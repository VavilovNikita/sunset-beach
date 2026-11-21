import { describe, expect, it } from "vitest";
import { NOTES_MAX_LENGTH, notesCounter, notesError, notesForCreate, notesPatchBody } from "@/lib/bookingNotes";

describe("booking notes", () => {
  it("accepts up to 1000 characters after trimming and refuses more", () => {
    expect(notesError("x".repeat(NOTES_MAX_LENGTH))).toBeNull();
    expect(notesError(`  ${"x".repeat(NOTES_MAX_LENGTH)}  `)).toBeNull();
    expect(notesError("x".repeat(NOTES_MAX_LENGTH + 1))).toMatch(/at most 1000/);
  });
  it("sends notes at creation only when there are some", () => {
    expect(notesForCreate("   ")).toBeUndefined();
    expect(notesForCreate("  Airport pickup  ")).toBe("Airport pickup");
  });
  it("clears with null on save, and always carries the booking's own status", () => {
    expect(notesPatchBody("CONFIRMED", "  ")).toEqual({ status: "CONFIRMED", notes: null });
    expect(notesPatchBody("NEW", " Allergic to peanuts ")).toEqual({ status: "NEW", notes: "Allergic to peanuts" });
  });
  it("counts what would be saved", () => {
    expect(notesCounter(" abc ")).toBe("3 / 1000");
  });
});
