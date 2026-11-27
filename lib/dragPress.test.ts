import { describe, expect, it } from "vitest";
import { pressMoved, releasedUnseen } from "./dragPress";

describe("pressMoved", () => {
  const press = { clientX: 100, clientY: 100 };

  it("is a click while the pointer stays within a few pixels", () => {
    expect(pressMoved(press, { clientX: 102, clientY: 103 })).toBe(false);
  });

  it("is a drag beyond them, in any direction", () => {
    expect(pressMoved(press, { clientX: 110, clientY: 100 })).toBe(true);
    expect(pressMoved(press, { clientX: 100, clientY: 90 })).toBe(true);
    expect(pressMoved(press, { clientX: -50, clientY: -20 })).toBe(true);
  });
});

describe("releasedUnseen", () => {
  it("is a mouse moving with no button down", () => {
    expect(releasedUnseen({ pointerType: "mouse", buttons: 0 })).toBe(true);
    expect(releasedUnseen({ pointerType: "mouse", buttons: 1 })).toBe(false);
    expect(releasedUnseen({ pointerType: "touch", buttons: 0 })).toBe(false);
  });
});
