import { describe, expect, it } from "vitest";
import { mapImageNotice, mapImageState, showsTileGrid } from "@/lib/mapImageFallback";

describe("mapImageState", () => {
  it("is the plan when one is recorded and loads", () => {
    expect(mapImageState(true, false)).toBe("image");
  });

  it("is 'failed' when a plan is recorded but the file 404s or does not load", () => {
    expect(mapImageState(true, true)).toBe("failed");
  });

  it("is 'never-uploaded' without a recorded plan, whatever the load flag says", () => {
    expect(mapImageState(false, false)).toBe("never-uploaded");
    expect(mapImageState(false, true)).toBe("never-uploaded");
  });
});

describe("showsTileGrid", () => {
  it("lists the rooms/tables as buttons whenever there is no usable plan to place them on", () => {
    expect(showsTileGrid("image")).toBe(false);
    expect(showsTileGrid("failed")).toBe(true);
    expect(showsTileGrid("never-uploaded")).toBe(true);
  });
});

describe("mapImageNotice", () => {
  it("says nothing while the plan is fine", () => {
    expect(mapImageNotice("image", true)).toBeNull();
  });

  it("tells a manager that a recorded plan is missing and to upload it again - as an error", () => {
    const notice = mapImageNotice("failed", true, "floor plan");
    expect(notice?.tone).toBe("error");
    expect(notice?.text).toContain("floor plan image was not found");
    expect(notice?.text).toContain("upload it again");
  });

  it("does not tell someone who cannot upload to upload", () => {
    const notice = mapImageNotice("failed", false);
    expect(notice?.tone).toBe("error");
    expect(notice?.text).not.toMatch(/upload it again \(above\)/);
    expect(notice?.text).toContain("ask a manager");
  });

  it("treats 'never uploaded' as information, not as a fault", () => {
    expect(mapImageNotice("never-uploaded", true)?.tone).toBe("info");
    expect(mapImageNotice("never-uploaded", false)?.text).toBe("No map image has been uploaded yet.");
  });
});
