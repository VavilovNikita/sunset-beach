import { describe, expect, it } from "vitest";
import { FLYOUT_CLOSED, FLYOUT_CLOSE_DELAY_MS, flyoutReducer, type FlyoutEvent, type FlyoutState } from "./navFlyout";

function run(events: FlyoutEvent[], from: FlyoutState = FLYOUT_CLOSED): FlyoutState {
  return events.reduce(flyoutReducer, from);
}
const hovered = (open: string): FlyoutState => ({ open, closePending: false, byHover: true });
const pinned = (open: string): FlyoutState => ({ open, closePending: false, byHover: false });

describe("flyoutReducer", () => {
  it("the delay is about 200 ms", () => {
    expect(FLYOUT_CLOSE_DELAY_MS).toBe(200);
  });

  it("hovering a heading opens its panel", () => {
    expect(run([{ type: "hoverIn", group: "Spa" }])).toEqual(hovered("Spa"));
  });

  it("hovering another heading switches at once, with no timer left running", () => {
    const state = run([
      { type: "hoverIn", group: "Spa" },
      { type: "hoverOut" },
      { type: "hoverIn", group: "Staff" },
    ]);
    expect(state).toEqual(hovered("Staff"));
    // the first heading's timer fires late: nothing to close
    expect(flyoutReducer(state, { type: "closeTimer" })).toBe(state);
  });

  it("leaving starts the close timer; the timer closes the panel", () => {
    const leaving = run([{ type: "hoverIn", group: "Spa" }, { type: "hoverOut" }]);
    expect(leaving.closePending).toBe(true);
    expect(leaving.open).toBe("Spa");
    expect(flyoutReducer(leaving, { type: "closeTimer" })).toEqual(FLYOUT_CLOSED);
  });

  it("coming back before the timer fires cancels the close", () => {
    const back = run([{ type: "hoverIn", group: "Spa" }, { type: "hoverOut" }, { type: "hoverIn", group: "Spa" }]);
    expect(back).toEqual(hovered("Spa"));
    expect(flyoutReducer(back, { type: "closeTimer" })).toEqual(hovered("Spa"));
  });

  it("leaving while keyboard focus is inside the panel does not start the timer", () => {
    const state = run([{ type: "open", group: "Spa" }, { type: "hoverOut", keepOpen: true }]);
    expect(state).toEqual(pinned("Spa"));
    expect(flyoutReducer(state, { type: "closeTimer" })).toEqual(pinned("Spa"));
  });

  it("leaving with nothing open does nothing", () => {
    expect(run([{ type: "hoverOut" }])).toEqual(FLYOUT_CLOSED);
  });

  it("a click on a closed heading opens, a second click closes, a click on another heading switches", () => {
    expect(run([{ type: "click", group: "Spa" }])).toEqual(pinned("Spa"));
    expect(run([{ type: "click", group: "Spa" }, { type: "click", group: "Spa" }])).toEqual(FLYOUT_CLOSED);
    expect(run([{ type: "click", group: "Spa" }, { type: "click", group: "Staff" }])).toEqual(pinned("Staff"));
  });

  it("a click on a heading the cursor already opened keeps the panel open; the next click closes it", () => {
    const afterClick = run([{ type: "hoverIn", group: "Spa" }, { type: "click", group: "Spa" }]);
    expect(afterClick).toEqual(pinned("Spa"));
    expect(flyoutReducer(afterClick, { type: "click", group: "Spa" })).toEqual(FLYOUT_CLOSED);
  });

  it("a click while the close timer is running cancels the close", () => {
    const state = run([{ type: "hoverIn", group: "Spa" }, { type: "hoverOut" }, { type: "click", group: "Spa" }]);
    expect(state).toEqual(pinned("Spa"));
    expect(flyoutReducer(state, { type: "closeTimer" })).toEqual(pinned("Spa"));
  });

  it("the keyboard open never toggles an already open panel shut", () => {
    expect(run([{ type: "hoverIn", group: "Spa" }, { type: "open", group: "Spa" }])).toEqual(pinned("Spa"));
  });

  it("Escape / outside click / link click / Tab out close at once, and closing twice is harmless", () => {
    const open = run([{ type: "hoverIn", group: "Spa" }]);
    expect(flyoutReducer(open, { type: "close" })).toEqual(FLYOUT_CLOSED);
    expect(flyoutReducer(FLYOUT_CLOSED, { type: "close" })).toBe(FLYOUT_CLOSED);
  });
});
