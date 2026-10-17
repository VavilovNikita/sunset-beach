// State of the desktop sidebar's flyout panels, as a pure reducer - kept out of AdminSidebar.tsx so
// the timing rules (a panel closes ~200 ms after the cursor leaves, and coming back cancels that) are
// tested, not eyeballed. The component owns the timer; this only says what each event does.

export const FLYOUT_CLOSE_DELAY_MS = 200;

export type FlyoutState = {
  // Title of the group whose panel is showing; one at a time.
  open: string | null;
  // The cursor has left and the close timer is running. A timer that fires after this was cleared
  // (the cursor came back, another panel opened) finds it false and does nothing.
  closePending: boolean;
  // The panel was opened by the cursor alone. A click on its heading then keeps it open instead of
  // closing it: a mouse user who has just seen the panel appear and clicks the heading means "open",
  // not "shut". Touch has no hover, so there a tap opens and the next tap closes.
  byHover: boolean;
};

export type FlyoutEvent =
  | { type: "hoverIn"; group: string }
  // keepOpen: keyboard focus is inside the panel, which stays open however the cursor moves.
  | { type: "hoverOut"; keepOpen?: boolean }
  | { type: "closeTimer" }
  | { type: "click"; group: string }
  // Keyboard open (Enter, Space, ArrowDown): always opens, never toggles.
  | { type: "open"; group: string }
  // Escape, a click outside, a click on a link, Tab out of the panel, navigation.
  | { type: "close" };

export const FLYOUT_CLOSED: FlyoutState = { open: null, closePending: false, byHover: false };

export function flyoutReducer(state: FlyoutState, event: FlyoutEvent): FlyoutState {
  switch (event.type) {
    case "hoverIn":
      // Hovering the heading of a panel a click or key opened leaves it as it is (not hover-owned).
      return { open: event.group, closePending: false, byHover: state.open === event.group ? state.byHover : true };
    case "open":
      return { open: event.group, closePending: false, byHover: false };
    case "hoverOut":
      if (state.open === null || event.keepOpen) return state;
      return { ...state, closePending: true };
    case "closeTimer":
      return state.closePending ? FLYOUT_CLOSED : state;
    case "click":
      if (state.open !== event.group) return { open: event.group, closePending: false, byHover: false };
      return state.byHover ? { open: event.group, closePending: false, byHover: false } : FLYOUT_CLOSED;
    case "close":
      return state.open === null ? state : FLYOUT_CLOSED;
  }
}
