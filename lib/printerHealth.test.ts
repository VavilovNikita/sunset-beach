import { describe, expect, it } from "vitest";
import { printerHealth } from "./printerHealth";

const NOW = new Date("2026-10-03T12:00:00Z");

describe("printerHealth", () => {
  it("is offline when the newest attempt failed, even if it printed earlier", () => {
    const health = printerHealth({ lastSentAt: "2026-10-03T10:00:00Z", lastFailedAt: "2026-10-03T11:00:00Z" }, NOW);
    expect(health.state).toBe("offline");
    expect(health.label).toBe("Not answering — last attempt failed 3 Oct 2026, 18:00; last printed 3 Oct 2026, 17:00");
  });

  it("is offline when it has only ever failed", () => {
    expect(printerHealth({ lastSentAt: null, lastFailedAt: "2026-10-03T11:00:00Z" }, NOW).state).toBe("offline");
  });

  it("is online when a print succeeded after the last failure", () => {
    const health = printerHealth({ lastSentAt: "2026-10-03T11:30:00Z", lastFailedAt: "2026-10-03T11:00:00Z" }, NOW);
    expect(health).toEqual({ state: "online", label: "Online — last printed 3 Oct 2026, 18:30" });
  });

  it("only claims quiet, not online, after a day without a print", () => {
    expect(printerHealth({ lastSentAt: "2026-10-01T11:00:00Z" }, NOW).state).toBe("quiet");
  });

  it("is unknown when it has never been used", () => {
    expect(printerHealth({}, NOW).state).toBe("unknown");
  });
});
