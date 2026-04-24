export const MONTHS = [
  "APR",
  "MAY",
  "JUN",
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
  JUN: "Jun",
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

export function currentFiscalMonthIndex(now = new Date()) {
  const m = now.getMonth();
  return m >= 3 ? m - 3 : m + 9;
}

export function monthYear(fy: number, monthIdx: number) {
  return monthIdx <= 8 ? fy : fy + 1;
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
