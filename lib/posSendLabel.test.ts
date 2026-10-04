import { describe, expect, it } from "vitest";
import { sendButtonLabel } from "@/lib/posSendLabel";

describe("sendButtonLabel", () => {
  it("names the station each line actually goes to", () => {
    expect(sendButtonLabel(["KITCHEN", "KITCHEN"]).label).toBe("Send to kitchen");
    expect(sendButtonLabel(["BAR"]).label).toBe("Send to bar");
    expect(sendButtonLabel(["BAR", "KITCHEN"]).label).toBe("Send to kitchen & bar");
  });

  it("never promises a kitchen ticket for spa treatments", () => {
    const spa = sendButtonLabel(["SPA", "SPA"]);
    expect(spa.label).not.toMatch(/kitchen/i);
    expect(spa.note).toBe("Spa treatments don't print a ticket.");
  });

  it("ignores spa lines next to food, which print as usual", () => {
    expect(sendButtonLabel(["SPA", "KITCHEN"])).toEqual({ label: "Send to kitchen", note: null });
  });

  it("falls back to a plain Send with nothing to send", () => {
    expect(sendButtonLabel([]).label).toBe("Send");
  });
});
