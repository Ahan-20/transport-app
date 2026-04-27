// School year covers 11 fee months. June is summer break — no transport,
// no fees, not shown in any UI. Annual-fee math everywhere should use
// MONTHS.length (= 11), never a hardcoded 12.
export const MONTHS = [
  "APR",
  "MAY",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
  "JAN",
  "FEB",
  "MAR",
] as const;

export type MonthCode = (typeof MONTHS)[number];

export const MONTH_LABEL: Record<MonthCode, string> = {
  APR: "Apr",
  MAY: "May",
  JUL: "Jul",
  AUG: "Aug",
  SEP: "Sep",
  OCT: "Oct",
  NOV: "Nov",
  DEC: "Dec",
  JAN: "Jan",
  FEB: "Feb",
  MAR: "Mar",
};

export function currentFiscalYear(now = new Date()) {
  const m = now.getMonth();
  const y = now.getFullYear();
  return m >= 3 ? y : y - 1;
}

export function academicLabel(fy: number) {
  const short = String((fy + 1) % 100).padStart(2, "0");
  return `${fy}-${short}`;
}

// Maps the calendar month (Date.getMonth(), 0-11) to the index inside MONTHS.
// June (m=5) is summer break: there's no fee row for it, so we hold the
// index at May (= 1) until July rolls around. After June, July becomes
// index 2 (since JUN was removed from the array).
export function currentFiscalMonthIndex(now = new Date()) {
  const m = now.getMonth();
  // m: 0=Jan, 1=Feb, 2=Mar, 3=Apr, 4=May, 5=Jun, 6=Jul, 7=Aug, 8=Sep,
  //    9=Oct, 10=Nov, 11=Dec
  if (m === 3) return 0; // Apr
  if (m === 4) return 1; // May
  if (m === 5) return 1; // Jun → freeze on May (no fee month)
  if (m >= 6 && m <= 11) return m - 4; // Jul..Dec → 2..7
  return m + 8; // Jan..Mar → 8..10
}

// Maps a fiscal-month index back to the calendar year. Apr-Dec belong to
// the fiscal year `fy`; Jan-Mar are in `fy + 1`. With JUN removed:
// indexes 0..7 = Apr-Dec (fy), indexes 8..10 = Jan-Mar (fy+1).
export function monthYear(fy: number, monthIdx: number) {
  return monthIdx <= 7 ? fy : fy + 1;
}

// Per-student enrollment window. NULL start = APR, NULL end = MAR.
// Returns the fiscal-ordered list of months the student is billed for
// (already excludes JUN since MONTHS does).
export function monthsInRange(
  start: MonthCode | null | undefined,
  end: MonthCode | null | undefined,
): MonthCode[] {
  const startIdx = start ? MONTHS.indexOf(start) : 0;
  const endIdx = end ? MONTHS.indexOf(end) : MONTHS.length - 1;
  if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return [];
  return MONTHS.slice(startIdx, endIdx + 1);
}

export function isMonthActive(
  month: MonthCode,
  start: MonthCode | null | undefined,
  end: MonthCode | null | undefined,
): boolean {
  const i = MONTHS.indexOf(month);
  const s = start ? MONTHS.indexOf(start) : 0;
  const e = end ? MONTHS.indexOf(end) : MONTHS.length - 1;
  return i >= 0 && i >= s && i <= e;
}

// Pretty label for an enrollment window. Returns "Full year" if neither
// bound is set, otherwise "Apr → Oct (6 months)" style.
export function enrollmentLabel(
  start: MonthCode | null | undefined,
  end: MonthCode | null | undefined,
): string {
  if (!start && !end) return "Full year";
  const months = monthsInRange(start, end);
  if (months.length === 0) return "—";
  const first = months[0];
  const last = months[months.length - 1];
  if (first === last) return `${MONTH_LABEL[first]} only (1 month)`;
  return `${MONTH_LABEL[first]} → ${MONTH_LABEL[last]} (${months.length} months)`;
}

export function formatINR(n: number | null | undefined) {
  if (n == null) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function formatINRCompact(n: number | null | undefined) {
  if (n == null) return "—";
  const v = Math.round(n);
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(2)} L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toLocaleString("en-IN")}`;
}
