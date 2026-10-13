import { describe, expect, it } from "vitest";
import { consumeOwnPopState, noteOwnBack } from "@/lib/useCloseOnBrowserBack";

function event() {
  const e = { stopped: 0, stopImmediatePropagation() { this.stopped++; } };
  return e;
}

describe("the popstate of an overlay's own back()", () => {
  it("is swallowed so the router never restores an older page state over a refresh in flight", () => {
    noteOwnBack();
    const e = event();
    expect(consumeOwnPopState(e)).toBe(true);
    expect(e.stopped).toBe(1);
  });

  it("is swallowed once per back() we called, no more", () => {
    noteOwnBack();
    noteOwnBack();
    expect(consumeOwnPopState(event())).toBe(true);
    expect(consumeOwnPopState(event())).toBe(true);
    const user = event();
    expect(consumeOwnPopState(user)).toBe(false);
    expect(user.stopped).toBe(0);
  });

  it("leaves a popstate the user caused (the Back button) alone", () => {
    const e = event();
    expect(consumeOwnPopState(e)).toBe(false);
    expect(e.stopped).toBe(0);
  });
});
