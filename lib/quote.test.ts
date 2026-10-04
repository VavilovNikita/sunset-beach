import { describe, expect, it } from "vitest";
import { formatQuoteTotal, quotePath, toQuoteResult, QUOTE_FALLBACK_ERROR } from "./quote";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("toQuoteResult", () => {
  it("passes the server's quote through untouched", async () => {
    const quote = { totalPrice: "12500.00", nights: 3, available: true, reason: null };
    expect(await toQuoteResult(json(200, quote))).toEqual({ ok: true, quote });
  });

  it("surfaces a 400's validation message, not a generic one", async () => {
    const res = json(400, { error: { formErrors: [], fieldErrors: { checkOut: ["a stay can be at most 90 nights"] } } });
    expect(await toQuoteResult(res)).toEqual({ ok: false, status: 400, message: "a stay can be at most 90 nights" });
  });

  it("surfaces a 429's plain error text", async () => {
    const res = json(429, { error: "Too many price requests from this address. Please try again later." });
    expect(await toQuoteResult(res)).toMatchObject({ ok: false, status: 429, message: expect.stringContaining("Too many") });
  });

  it("falls back to a generic message for a non-JSON failure", async () => {
    expect(await toQuoteResult(new Response("Bad gateway", { status: 502 }))).toEqual({
      ok: false,
      status: 502,
      message: QUOTE_FALLBACK_ERROR,
    });
  });
});

describe("formatQuoteTotal", () => {
  it("formats the server's decimal string without re-deriving it", () => {
    expect(formatQuoteTotal({ totalPrice: "12500.00", nights: 3, available: true, reason: null })).toBe("฿12,500");
  });
});

describe("quotePath", () => {
  it("builds the quote URL with both dates as query parameters", () => {
    expect(quotePath("room-1", "2026-10-30", "2026-11-02")).toBe(
      "/public/rooms/room-1/quote?checkIn=2026-10-30&checkOut=2026-11-02"
    );
  });
});
