import { describe, expect, it } from "vitest";
import { isSpaOrder, orderBackLink } from "@/lib/posOrderBack";

const restaurant = { spaAppointmentId: null, createdAt: "2033-05-10T18:30:00Z" };
// 18:30 UTC is 01:30 the next morning in Bangkok - the schedule link must use the hotel's date.
const spa = { spaAppointmentId: "a1", createdAt: "2033-05-10T18:30:00Z" };

describe("orderBackLink", () => {
  it("sends a restaurant ticket back to the floor board of its own surface", () => {
    expect(orderBackLink("/admin/pos", restaurant, "RESTAURANT")).toEqual({ href: "/admin/pos", label: "← Back to tables" });
    expect(orderBackLink("/pos", restaurant, "BAR")).toEqual({ href: "/pos", label: "← Back to tables" });
  });

  it("sends a desktop spa ticket back to that day's spa schedule, in hotel time", () => {
    expect(orderBackLink("/admin/pos", spa, null)).toEqual({ href: "/admin/spa?date=2033-05-11", label: "← Spa schedule" });
    expect(orderBackLink("/admin/pos", restaurant, "SPA").label).toBe("← Spa schedule");
  });

  it("keeps the phone on its own board even for a spa ticket", () => {
    expect(orderBackLink("/pos", spa, "SPA").href).toBe("/pos");
  });
});

describe("isSpaOrder", () => {
  it("is a spa ticket when it bills an appointment or sits on a spa table", () => {
    expect(isSpaOrder(spa, null)).toBe(true);
    expect(isSpaOrder(restaurant, "SPA")).toBe(true);
    expect(isSpaOrder(restaurant, "RESTAURANT")).toBe(false);
  });
});
