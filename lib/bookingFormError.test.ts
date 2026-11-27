import { describe, expect, it } from "vitest";
import { bookingFormError } from "./bookingFormError";

describe("bookingFormError", () => {
  it("puts the server's sentence on the field it names", () => {
    const body = { error: { formErrors: [], fieldErrors: { paymentNote: ["This looks like it contains a payment card number."] } } };
    expect(bookingFormError("x", body)).toEqual({
      field: "paymentNote",
      message: "This looks like it contains a payment card number.",
      summary: "Not saved - see Payment note. What you entered is still here.",
    });
  });

  it("is about the whole save when no field of the form is named", () => {
    expect(bookingFormError("Someone else changed it", null)).toEqual({
      field: null,
      message: "Someone else changed it",
      summary: "Not saved: Someone else changed it",
    });
    expect(bookingFormError("Bad", { error: { fieldErrors: { somethingElse: ["x"] } } }).field).toBeNull();
    expect(bookingFormError("Forbidden", { error: "Forbidden" }).field).toBeNull();
  });
});
