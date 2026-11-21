import { describe, expect, it } from "vitest";
import { describeAuditActor, describeAuditEntity, describeAuditEntry, humanizeAuditSummary } from "@/lib/auditDisplay";

describe("humanizeAuditSummary - booking statuses", () => {
  it("reads NEW as Tentative in a status change and at creation", () => {
    expect(humanizeAuditSummary("Status changed from NEW to CONFIRMED for Jane in Villa")).toBe("Status changed from Tentative to Confirmed for Jane in Villa");
    expect(humanizeAuditSummary("Status changed from CONFIRMED to PAID; notes added for Jane")).toBe("Status changed from Confirmed to Room paid; notes added for Jane");
    expect(humanizeAuditSummary("Staff booking created for Jane in Villa (2026-12-01 to 2026-12-03); status NEW")).toContain("; status Tentative");
  });
});

describe("humanizeAuditSummary", () => {
  it("turns a payment method enum into words", () => {
    expect(humanizeAuditSummary("Order closed with ROOM_CHARGE payment of 1000.00 (charged to QA Petrov's room)")).toBe(
      "Order closed with room charge payment of 1000.00 (charged to QA Petrov's room)",
    );
  });

  it("shortens a full record id to the 8-character reference", () => {
    expect(humanizeAuditSummary("Room charge of 450.00 posted to Petrov's folio from order 616639e2-7f57-461c-959c-e4aac0078a1d")).toBe(
      "Room charge of 450.00 posted to Petrov's folio from order 616639E2",
    );
  });

  it("words status transitions", () => {
    expect(humanizeAuditSummary("Booking status changed from NEW to NO_SHOW")).toBe("Booking status changed from Tentative to no show");
  });

  it("leaves upper-case words that aren't enum values alone", () => {
    expect(humanizeAuditSummary('Kind for code "OP" set to OPEN_SCHEDULE for VIP guest')).toBe('Kind for code "OP" set to open schedule for VIP guest');
  });
});

describe("describeAuditActor", () => {
  it("shows a role label, not the raw enum", () => {
    expect(describeAuditActor("anna@example.com", "MANAGER")).toBe("anna@example.com (Manager)");
  });

  it("shows a system action as System, without the sentinel email", () => {
    expect(describeAuditActor("system@sunsetbeach.internal", null)).toBe("System");
  });
});

describe("describeAuditEntity", () => {
  it("names the record type and its short reference", () => {
    expect(describeAuditEntity("SPA_APPOINTMENT", "a8a91f80-3f1e-49c4-a05f-f5d685cf580b")).toBe("Spa appointment A8A91F80");
    expect(describeAuditEntity("SPA_APPOINTMENT", "b46a37ac-1774-406f-a0f9-55131782a911")).toBe("Spa appointment B46A37AC");
  });

  it("keeps an id that isn't a uuid as is", () => {
    expect(describeAuditEntity("SETTINGS", "1")).toBe("Settings 1");
  });
});

describe("describeAuditEntry - the one reading of an entry (booking page History and calendar panel)", () => {
  it("shows status labels and the role label, never the raw values", () => {
    const entry = describeAuditEntry({
      summary: "Status changed from CONFIRMED to PAID for Jane in Villa",
      actorEmail: "anna@example.com",
      actorRole: "MANAGER",
    });
    expect(entry.text).toBe("Status changed from Confirmed to Room paid for Jane in Villa");
    expect(entry.actor).toBe("anna@example.com (Manager)");
  });

  it("shows a creation entry's status as a label and a system row as System", () => {
    expect(
      describeAuditEntry({ summary: "Staff booking created for Jane in Villa; status NEW", actorEmail: "system@sunsetbeach.internal", actorRole: null }),
    ).toEqual({ text: "Staff booking created for Jane in Villa; status Tentative", actor: "System" });
  });
});
