// The "Amount collected" box of the folio payment form starts at the server's balance due. When that balance changes
// under an open page (a relocation, a reprice, an extension - the page refreshes), an amount the person never touched
// follows it; one they have started typing stays.
export type FolioAmountState = { amount: string; touched: boolean; outstanding: string };

export function startFolioAmount(outstanding: string): FolioAmountState {
  return { amount: outstanding, touched: false, outstanding };
}

export function typeFolioAmount(state: FolioAmountState, amount: string): FolioAmountState {
  return { ...state, amount, touched: true };
}

export function followOutstanding(state: FolioAmountState, outstanding: string): FolioAmountState {
  if (outstanding === state.outstanding) return state;
  return state.touched ? { ...state, outstanding } : { amount: outstanding, touched: false, outstanding };
}
