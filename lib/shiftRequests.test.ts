import { describe, expect, it } from "vitest";
import {
  administratorNote,
  canReadShiftRequests,
  coverageSentences,
  decidersSummary,
  decisionCommentError,
  decisionLine,
  defaultRequestFilters,
  isValidDateKey,
  requestEmployeeOptions,
  requestFiltersError,
  requestHeadline,
  requestStatusClass,
  requestsQueryString,
  showDecisionButtons,
  vacationChanged,
  vacationFormError,
  vacationInput,
  waitingCount,
} from "./shiftRequests";
import type { ShiftChangeRequest, ShiftRequestDeciders } from "./types";

const request = (over: Partial<ShiftChangeRequest> = {}): ShiftChangeRequest => ({
  id: "r1",
  employeeUserId: "u1",
  employeeName: "Eve",
  type: "DELETE",
  status: "PENDING",
  channel: "TELEGRAM",
  shiftDate: "2026-11-03",
  shiftCode: "N1",
  shiftTimes: "09:00-18:00",
  createdAt: "2026-10-30T03:00:00Z",
  callerMayDecide: true,
  requiresAdministrator: false,
  ...over,
});

const deciders = (over: Partial<ShiftRequestDeciders> = {}): ShiftRequestDeciders => ({
  hrUserId: "hr",
  hrName: "Hana",
  onVacationToday: false,
  fallbackToAdmin: true,
  effectiveDeciders: ["Hana"],
  callerMayDecide: true,
  ...over,
});

describe("who may decide, as the buttons show it", () => {
  it("shows Approve / Reject only for a waiting request the caller may decide", () => {
    expect(showDecisionButtons(request())).toBe(true);
    // A MANAGER+ who is not one of today's deciders reads the request without buttons.
    expect(showDecisionButtons(request({ callerMayDecide: false }))).toBe(false);
    // The server only sets callerMayDecide on a PENDING one, but a settled one never gets buttons whatever it says.
    expect(showDecisionButtons(request({ status: "APPROVED", callerMayDecide: true }))).toBe(false);
    expect(showDecisionButtons(request({ status: "EXPIRED", callerMayDecide: true }))).toBe(false);
  });

  it("opens the pages to MANAGER+ or the HR function, never to a role alone below MANAGER", () => {
    expect(canReadShiftRequests("WAITER", [])).toBe(false);
    expect(canReadShiftRequests("CASHIER", ["ENGINEER", "THERAPIST"])).toBe(false);
    expect(canReadShiftRequests("WAITER", ["HR"])).toBe(true);
    expect(canReadShiftRequests("MANAGER", [])).toBe(true);
    expect(canReadShiftRequests("ADMIN", [])).toBe(true);
  });

  it("says who decides today, including the leave and the fallback", () => {
    expect(decidersSummary(deciders())).toBe("Hana decides.");
    expect(decidersSummary(deciders({ onVacationToday: true, effectiveDeciders: ["Admin One"] }))).toContain("on leave today");
    expect(decidersSummary(deciders({ hrUserId: undefined, hrName: undefined, effectiveDeciders: ["Admin One", "Admin Two"] }))).toContain("Nobody holds the HR function");
    expect(decidersSummary(deciders({ onVacationToday: true, effectiveDeciders: [], fallbackToAdmin: false }))).toContain("requests wait");
    expect(decidersSummary(deciders({ hrUserId: undefined, hrName: undefined, effectiveDeciders: [], fallbackToAdmin: false }))).toContain("requests wait");
  });
});

describe("what a request says", () => {
  it("words a move and a day off from the snapshot, with hotel dates", () => {
    expect(requestHeadline(request())).toBe("Day off 3 Nov 2026 (N1 09:00-18:00)");
    expect(requestHeadline(request({ type: "MOVE", targetDate: "2026-11-05" }))).toBe("Move 3 Nov 2026 (N1 09:00-18:00) to 5 Nov 2026");
    expect(requestHeadline(request({ shiftTimes: undefined }))).toBe("Day off 3 Nov 2026 (N1)");
  });

  it("flags a day below the minimum - as information, with both days of a move", () => {
    const area = () => "Kitchen";
    expect(coverageSentences(undefined, area)).toEqual([]);
    const move = coverageSentences(
      { staffArea: "KITCHEN", minimumWorking: 2, sourceDate: "2026-11-03", sourceWorkingAfter: 1, targetDate: "2026-11-05", targetWorkingAfter: 3, belowMinimum: true },
      area
    );
    expect(move).toEqual([
      { text: "Kitchen: 1 would work on 3 Nov 2026 (minimum 2)", warn: true },
      { text: "Kitchen: 3 would work on 5 Nov 2026 (minimum 2)", warn: false },
    ]);
    // Exactly the minimum is fine.
    expect(coverageSentences({ staffArea: "KITCHEN", minimumWorking: 2, sourceDate: "2026-11-03", sourceWorkingAfter: 2, belowMinimum: false }, area)[0].warn).toBe(false);
  });

  it("describes how a request ended", () => {
    const moment = () => "3 Nov 2026, 14:05";
    expect(decisionLine(request(), moment)).toBeNull();
    expect(decisionLine(request({ status: "APPROVED", decidedByName: "Hana", decidedAt: "x" }), moment)).toBe("Approved by Hana · 3 Nov 2026, 14:05");
    expect(decisionLine(request({ status: "REJECTED", decidedByName: "Hana", decidedAt: "x" }), moment)).toBe("Rejected by Hana · 3 Nov 2026, 14:05");
    expect(decisionLine(request({ status: "CANCELLED" }), moment)).toBe("Withdrawn");
    expect(decisionLine(request({ status: "EXPIRED", expiredReason: "The shift was changed in the roster after the request was made." }), moment)).toBe(
      "The shift was changed in the roster after the request was made."
    );
  });

  it("uses the palette's meanings: waiting is amber, done green, expired and rejected coral", () => {
    expect(requestStatusClass("PENDING")).toContain("amber-400");
    expect(requestStatusClass("APPROVED")).toContain("green-600");
    expect(requestStatusClass("REJECTED")).toContain("coral");
    expect(requestStatusClass("EXPIRED")).toContain("coral");
    expect(requestStatusClass("CANCELLED")).toContain("cream");
  });

  it("counts the waiting ones", () => {
    expect(waitingCount([request(), request({ status: "APPROVED" }), request({ status: "PENDING" })])).toBe(2);
  });
});

describe("filters", () => {
  it("opens on the waiting requests and sends only what is set", () => {
    expect(requestsQueryString(defaultRequestFilters())).toBe("status=PENDING");
    expect(requestsQueryString({ status: "", from: "2026-11-01", to: "2026-11-30", employeeUserId: "" })).toBe("from=2026-11-01&to=2026-11-30");
    expect(requestsQueryString({ status: "EXPIRED", from: "", to: "", employeeUserId: "" })).toBe("status=EXPIRED");
    // The employee filter is the server's own parameter.
    expect(requestsQueryString({ status: "PENDING", from: "", to: "", employeeUserId: "u 1" })).toBe("status=PENDING&employeeUserId=u+1");
  });

  it("refuses a backwards range before asking", () => {
    expect(requestFiltersError({ status: "", from: "2026-11-05", to: "2026-11-01", employeeUserId: "" })).toContain("on or before");
    expect(requestFiltersError({ status: "", from: "2026-11-01", to: "2026-11-01", employeeUserId: "" })).toBeNull();
    expect(requestFiltersError({ status: "", from: "", to: "2026-11-01", employeeUserId: "" })).toBeNull();
  });

  it("says on a waiting request of the HR director that an administrator decides it, and nowhere else", () => {
    expect(administratorNote(request({ requiresAdministrator: true }))).toContain("administrator decides");
    expect(administratorNote(request({ requiresAdministrator: false }))).toBeNull();
    // Once settled the card's own decision line says who decided.
    expect(administratorNote(request({ requiresAdministrator: true, status: "APPROVED" }))).toBeNull();
    // The HR director gets no buttons for it: the server says callerMayDecide false, and the buttons follow that alone.
    expect(showDecisionButtons(request({ requiresAdministrator: true, callerMayDecide: false }))).toBe(false);
  });

  it("offers the roster's employees and anyone on screen for the employee filter, by name", () => {
    const options = requestEmployeeOptions(
      [
        { id: "b", name: "Zoe" },
        { id: "a", name: "Anna" },
      ],
      [
        { employeeUserId: "a", employeeName: "Anna" },
        { employeeUserId: "gone", employeeName: "Former Employee" },
      ]
    );
    expect(options).toEqual([
      { id: "a", name: "Anna" },
      { id: "gone", name: "Former Employee" },
      { id: "b", name: "Zoe" },
    ]);
  });

  it("bounds the decision comment like the server (300)", () => {
    expect(decisionCommentError("x".repeat(300))).toBeNull();
    expect(decisionCommentError("x".repeat(301))).not.toBeNull();
    expect(decisionCommentError("   ")).toBeNull();
  });
});

describe("the HR director's leave", () => {
  it("accepts both dates or neither, in order, as real days", () => {
    expect(vacationFormError("", "")).toBeNull();
    expect(vacationFormError("2026-11-01", "")).toContain("both dates");
    expect(vacationFormError("", "2026-11-05")).toContain("both dates");
    expect(vacationFormError("2026-11-05", "2026-11-01")).toContain("can't be before");
    expect(vacationFormError("2026-11-01", "2026-11-01")).toBeNull();
    expect(vacationFormError("2026-02-30", "2026-03-02")).toContain("Dates like");
  });

  it("sends the dates together or an empty body to clear", () => {
    expect(vacationInput("2026-11-01", "2026-11-05")).toEqual({ from: "2026-11-01", to: "2026-11-05" });
    expect(vacationInput("", "")).toEqual({});
    expect(vacationInput("2026-11-01", "")).toEqual({});
  });

  it("enables Save only for a real change", () => {
    const saved = { vacationFrom: "2026-11-01", vacationTo: "2026-11-05" };
    expect(vacationChanged("2026-11-01", "2026-11-05", saved)).toBe(false);
    expect(vacationChanged("2026-11-01", "2026-11-06", saved)).toBe(true);
    expect(vacationChanged("", "", saved)).toBe(true);
    expect(vacationChanged("", "", {})).toBe(false);
  });

  it("tells a real calendar day from a shaped one", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2026-2-1")).toBe(false);
  });
});
