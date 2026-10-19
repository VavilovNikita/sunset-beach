import { describe, expect, it } from "vitest";
import {
  NO_MANUAL_PRICE,
  agreedTotalForRequest,
  agreedTotalServerError,
  editManualPrice,
  followCalculatedPrice,
  startManualPrice,
  useCalculatedPrice,
  validateManualPrice,
} from "@/lib/manualPrice";

describe("what is sent", () => {
  it("leaves agreedTotal out entirely while the field is off", () => {
    expect(agreedTotalForRequest(NO_MANUAL_PRICE)).toBeUndefined();
    expect(agreedTotalForRequest(useCalculatedPrice())).toBeUndefined();
  });

  it("sends the typed amount, trimmed, while it is on", () => {
    expect(agreedTotalForRequest(editManualPrice(startManualPrice("3700.00"), " 3500 "))).toBe("3500");
  });

  it("a field turned on and then back off sends nothing, whatever was typed", () => {
    const typed = editManualPrice(startManualPrice("3700.00"), "100");
    expect(agreedTotalForRequest(useCalculatedPrice())).toBeUndefined();
    expect(typed.manual).toBe(true);
  });
});

describe("starting and following the calculated price", () => {
  it("opens holding the calculated price, untouched", () => {
    expect(startManualPrice("3700.00")).toEqual({ manual: true, amount: "3700.00", touched: false });
    expect(startManualPrice(null)).toEqual({ manual: true, amount: "", touched: false });
  });

  it("an untouched amount follows new dates", () => {
    expect(followCalculatedPrice(startManualPrice("3700.00"), "5550.00").amount).toBe("5550.00");
  });

  it("an amount the user typed stays when the dates change", () => {
    const typed = editManualPrice(startManualPrice("3700.00"), "3000");
    expect(followCalculatedPrice(typed, "5550.00")).toBe(typed);
  });

  it("does nothing while the field is off or there is no quote", () => {
    expect(followCalculatedPrice(NO_MANUAL_PRICE, "5550.00")).toBe(NO_MANUAL_PRICE);
    const started = startManualPrice("3700.00");
    expect(followCalculatedPrice(started, null)).toBe(started);
  });

  it("retyping the same text still counts as touched", () => {
    expect(editManualPrice(startManualPrice("3700.00"), "3700.00").touched).toBe(true);
  });
});

describe("validateManualPrice", () => {
  it.each(["0", "3700", "3700.5", "3700.50", " 10000 ", "99999999.99"])("accepts %j", (text) => {
    expect(validateManualPrice(text)).toBeNull();
  });

  it.each(["", "   ", "-1", "12.345", "abc", "1e3", "3,700", "3700.", ".5", "100000000"])("rejects %j", (text) => {
    expect(validateManualPrice(text)).toEqual(expect.any(String));
  });

  it("asks for an amount when the box is empty", () => {
    expect(validateManualPrice("")).toBe("Enter the price for the whole stay.");
  });
});

describe("agreedTotalServerError", () => {
  it("takes a 400 on agreedTotal for the field", () => {
    const body = { error: { formErrors: [], fieldErrors: { agreedTotal: ["must match the pattern"] } } };
    expect(agreedTotalServerError(400, body)).toBe("must match the pattern");
  });

  it("leaves every other failure to the form as a whole", () => {
    expect(agreedTotalServerError(403, { error: "Only a manager can set the price of a booking by hand" })).toBeNull();
    expect(agreedTotalServerError(400, { error: { fieldErrors: { guestName: ["too short"] } } })).toBeNull();
    expect(agreedTotalServerError(400, null)).toBeNull();
  });
});
