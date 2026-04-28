import Link from "next/link";
import {
  getDrivers,
  getSchoolPaymentHistory,
  type SchoolPaymentLogRow,
} from "@/lib/queries";
import {
  MONTH_LABEL,
  MONTHS,
  formatINR,
  formatINRCompact,
  type MonthCode,
} from "@/lib/fiscal";
import { HistoryFilters } from "./filters";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  school?: string;
  driver?: string;
  month?: string;
  mode?: string;
  from?: string;
  to?: string;
}>;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const drivers = getDrivers();

  const rows = getSchoolPaymentHistory({
    q: sp.q || null,
    schoolCode: sp.school || null,
    driverId: sp.driver ? Number(sp.driver) : null,
    monthCode:
      sp.month && (MONTHS as readonly string[]).includes(sp.month)
        ? (sp.month as MonthCode)
        : null,
    mode: sp.mode || null,
    from: sp.from || null,
    to: sp.to || null,
    limit: 1000,
  });

  const total = rows.reduce((a, r) => a + (r.amount_paid ?? 0), 0);
  const distinctStudents = new Set(rows.map((r) => r.student_id)).size;

  return (
    <div className="space-y-6 fade-in">
      <section className="panel px-4 py-5 sm:px-7 sm:py-7 print:hidden">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-8">
          <div>
            <div className="label">Ledger</div>
            <h1 className="mt-3 text-[1.75rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)] sm:text-[2.5rem]">
              Payment history
            </h1>
            <p className="mt-3 text-[0.875rem] text-[var(--color-ink-2)] sm:text-[0.9375rem]">
              Every payment recorded across the school, newest first. Use the
              filters to narrow by school, driver, month, mode, or date range.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-baseline gap-6 text-right">
              <div>
                <div className="label">Entries</div>
                <div className="num mt-0.5 font-display text-2xl">
                  {rows.length.toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div className="label">Students</div>
                <div className="num mt-0.5 font-display text-2xl">
                  {distinctStudents.toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div className="label">Total</div>
                <div className="num mt-0.5 font-display text-2xl text-[var(--color-success)]">
                  {formatINRCompact(total)}
                </div>
              </div>
            </div>
            <PrintButton />
          </div>
        </div>
      </section>

      {/* Print-only header */}
      <section className="hidden print:block">
        <h1 className="text-2xl font-semibold">Payment history</h1>
        <p className="mt-1 text-sm">
          {rows.length} entries · {distinctStudents} students · {formatINR(total)} total
          {sp.from || sp.to ? ` · ${sp.from ?? "…"} → ${sp.to ?? "…"}` : ""}
          {sp.school ? ` · ${sp.school}` : ""}
          {sp.driver ? ` · driver #${sp.driver}` : ""}
          {sp.month ? ` · ${sp.month}` : ""}
        </p>
      </section>

      <HistoryFilters drivers={drivers} />

      <section className="panel overflow-x-auto print:overflow-visible print:border-0">
        <table className="grid">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th>Paid on</th>
              <th>Student</th>
              <th>School</th>
              <th>Driver</th>
              <th>For</th>
              <th className="num">Amount</th>
              <th>Mode</th>
              <th>Notes</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="py-10 text-center text-[var(--color-muted)]"
                >
                  <span className="mono text-[0.75rem] uppercase tracking-[0.08em]">
                    — NO PAYMENTS MATCH THESE FILTERS —
                  </span>
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="num text-[var(--color-muted-2)]">
                    {String(i + 1).padStart(3, "0")}
                  </td>
                  <td className="whitespace-nowrap font-medium text-[var(--color-ink)]">
                    {formatPaidOn(r.paid_on)}
                  </td>
                  <td className="whitespace-nowrap">
                    <Link
                      href={`/students/${r.student_id}`}
                      className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                    >
                      {r.student_name}
                    </Link>
                    {r.student_name_hindi ? (
                      <span className="ml-2 text-[var(--color-muted)]">
                        {r.student_name_hindi}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <span className="chip">{r.school_code}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    <Link
                      href={`/drivers/${r.driver_id}/edit`}
                      className="text-[var(--color-ink-2)] hover:text-[var(--color-accent)]"
                    >
                      {r.driver_name}
                    </Link>
                  </td>
                  <td className="mono whitespace-nowrap text-[0.6875rem] uppercase tracking-[0.08em]">
                    {MONTH_LABEL[r.month_code]} {r.fiscal_year}
                  </td>
                  <td className="num font-medium">
                    {formatINR(r.amount_paid)}
                  </td>
                  <td>
                    {r.mode ? (
                      <span className="chip">{r.mode}</span>
                    ) : (
                      <span className="text-[var(--color-muted-2)]">—</span>
                    )}
                  </td>
                  <td className="text-[0.8125rem] text-[var(--color-ink-2)]">
                    {r.notes ?? (
                      <span className="text-[var(--color-muted-2)]">—</span>
                    )}
                  </td>
                  <td
                    className="whitespace-nowrap text-[0.8125rem] text-[var(--color-muted)]"
                    title={
                      r.entered_at
                        ? `Saved at ${formatEnteredAt(r.entered_at)}`
                        : undefined
                    }
                  >
                    {r.entered_by_name ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {rows.length === 1000 ? (
        <p className="text-center text-[0.8125rem] text-[var(--color-muted)] print:hidden">
          Showing the first 1000 entries. Add a date range or driver filter to
          narrow down.
        </p>
      ) : null}
    </div>
  );
}

function formatPaidOn(s: string | null): string {
  if (!s) return "—";
  const monthMap: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };
  const mmm = s.match(/^(\d{4})-([A-Z]{3})-(\d{2})$/);
  const iso = mmm ? `${mmm[1]}-${monthMap[mmm[2]] ?? "01"}-${mmm[3]}` : s;
  const d = new Date(iso + (iso.includes("T") ? "" : "T00:00:00"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatEnteredAt(s: string): string {
  const d = new Date(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
