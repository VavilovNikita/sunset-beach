// Tabs of /admin/reports and the address that carries every tab's parameters. Each tab has its own
// (?date= for the manager report, ?from=&to= for the room and sales reports, ?limit= for guest
// LTV), and switching tabs or submitting one tab's form must not reset the others - same idea as
// the roster page's year/month surviving a tab change.

export const REPORT_TABS = [
  { key: "manager", label: "Manager report" },
  { key: "occupancy", label: "Occupancy" },
  { key: "production", label: "Top production" },
  { key: "segments", label: "Market segment" },
  { key: "sales", label: "Sales mix" },
  { key: "guests", label: "Guest LTV" },
] as const;

export type ReportTabKey = (typeof REPORT_TABS)[number]["key"];

export function parseReportTab(raw: string | undefined): ReportTabKey {
  return REPORT_TABS.find((t) => t.key === raw)?.key ?? REPORT_TABS[0].key;
}

// Raw, already-validated parameters as they stand in the address; absent means "not chosen", so the
// server's default (today, the default range, the default limit) keeps applying.
export type ReportsState = {
  tab: ReportTabKey;
  date?: string;
  from?: string;
  to?: string;
  limit?: string;
};

export type ReportsParamName = "date" | "from" | "to" | "limit";

const ORDER: ReportsParamName[] = ["date", "from", "to", "limit"];

function entries(state: ReportsState, omit: ReportsParamName[]): [string, string][] {
  const out: [string, string][] = [["tab", state.tab]];
  for (const name of ORDER) {
    const value = state[name];
    if (value && !omit.includes(name)) out.push([name, value]);
  }
  return out;
}

export function reportsHref(state: ReportsState, overrides: Partial<ReportsState> = {}): string {
  const params = new URLSearchParams(entries({ ...state, ...overrides }, []));
  return `/admin/reports?${params.toString()}`;
}

// What a tab's form sends as hidden inputs: the tab and every parameter except the ones its own
// inputs carry.
export function reportsHiddenFields(state: ReportsState, own: ReportsParamName[]): [string, string][] {
  return entries(state, own);
}
