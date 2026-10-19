// The new-booking form's "Set price manually" (BookingCreateFromGridModal -> POST /bookings/staff,
// StaffBookingCreateInput.agreedTotal). MANAGER+ only; the server enforces that, the form only hides
// the button. The server spreads the total over the nights and freezes it - nothing here sums or
// divides, it only decides what is typed, what is checked and whether the field is sent at all.
// Pure, tested in manualPrice.test.ts.

export type ManualPriceState = {
  // The field is on: agreedTotal is sent. Off: it is not sent at all.
  manual: boolean;
  // What is in the box, as typed.
  amount: string;
  // The user has edited the box. Until then it follows the calculated price when the dates change.
  touched: boolean;
};

export const NO_MANUAL_PRICE: ManualPriceState = { manual: false, amount: "", touched: false };

// The same shape the server accepts (StaffBookingCreateInput.agreedTotal): up to 8 digits and at most 2 decimals.
const AMOUNT_RE = /^\d{1,8}(\.\d{1,2})?$/;

// "Set price manually": the box opens holding the calculated price (the server's quote, a decimal string,
// as it came), or empty while there is no quote yet.
export function startManualPrice(calculated: string | null): ManualPriceState {
  return { manual: true, amount: calculated ?? "", touched: false };
}

// "Use calculated price": back to the server's price; the amount is forgotten and the field stops being sent.
export function useCalculatedPrice(): ManualPriceState {
  return NO_MANUAL_PRICE;
}

export function editManualPrice(state: ManualPriceState, amount: string): ManualPriceState {
  return { manual: state.manual, amount, touched: true };
}

// The dates changed and the server priced them again. An amount the user never touched follows the new
// calculated price; one they typed stays. A missing quote (still loading, or failed) leaves the box alone.
export function followCalculatedPrice(state: ManualPriceState, calculated: string | null): ManualPriceState {
  if (!state.manual || state.touched || calculated === null || state.amount === calculated) return state;
  return { ...state, amount: calculated };
}

// Null when the amount can be sent; otherwise the sentence for under the field.
export function validateManualPrice(amount: string): string | null {
  const text = amount.trim();
  if (text === "") return "Enter the price for the whole stay.";
  if (!AMOUNT_RE.test(text)) return "Enter an amount of 0 or more with at most 2 decimals, for example 3700 or 3700.50.";
  return null;
}

// What goes into the request: the typed amount while the field is on, undefined (the key is left out of
// the body altogether) while it is off. Callers validate first.
export function agreedTotalForRequest(state: ManualPriceState): string | undefined {
  return state.manual ? state.amount.trim() : undefined;
}

// A 400 from the server on agreedTotal (the admin proxy passes { error: { fieldErrors: { agreedTotal: [...] } } })
// belongs under the field. Anything else is a message for the form as a whole.
export function agreedTotalServerError(status: number, body: unknown): string | null {
  if (status !== 400 || !body || typeof body !== "object" || !("error" in body)) return null;
  const inner = (body as { error: unknown }).error;
  if (!inner || typeof inner !== "object") return null;
  const first = (inner as { fieldErrors?: Record<string, string[]> }).fieldErrors?.agreedTotal?.[0];
  return first ?? null;
}
