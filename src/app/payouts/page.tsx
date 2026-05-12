import Link from "next/link";
import { getDriverPayouts } from "@/lib/queries";
import {
  MONTHS,
  MONTH_LABEL,
  currentFiscalMonthIndex,
  currentFiscalYear,
  formatINR,
  formatINRCompact,
  type MonthCode,
} from "@/lib/fiscal";
import { PayoutRow } from "./payout-row";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const fy = currentFiscalYear();
  const month: MonthCode =
    sp.month && MONTHS.includes(sp.month as MonthCode)
      ? (sp.month as MonthCode)
      : MONTHS[currentFiscalMonthIndex()];

  const rows = getDriverPayouts(fy, month);

  const totals = rows.reduce(
    (a, r) => ({
      expected: a.expected + r.expected,
      collected: a.collected + r.collected,
      commission: a.commission + r.commission_amt,
      due: a.due + r.net_due,
      paid: a.paid + r.total_paid,
    }),
    { expected: 0, collected: 0, commission: 0, due: 0, paid: 0 },
  );
  const balance = totals.due - totals.paid;

  return (
    <div className="space-y-8 fade-in">
      <section className="panel px-7 py-7">
        <div className="label">Settlement</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          Driver payouts{" "}
          <span className="serif text-[2.5rem] text-[var(--color-accent)]">
            · {MONTH_LABEL[month]}
          </span>
        </h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-2)]">
          Net due {formatINR(totals.due)} · paid {formatINR(totals.paid)} ·{" "}
          <span
            className={
              balance > 0
                ? "text-[var(--color-negative)]"
                : balance < 0
                  ? "text-[var(--color-warn)]"
                  : "text-[var(--color-positive)]"
            }
          >
            {balance > 0
              ? `${formatINR(balance)} owed`
              : balance < 0
                ? `${formatINR(-balance)} overpaid`
                : "settled"}
          </span>
        </p>
      </section>

      <section className="panel flex flex-wrap items-center gap-1 px-4 py-3">
        <span className="label mr-2">MONTH</span>
        {MONTHS.map((m) => (
          <Link
            key={m}
            href={`/payouts?month=${m}`}
            className={`mono inline-flex h-7 items-center whitespace-nowrap rounded-sm border px-2 text-[0.6875rem] uppercase tracking-[0.06em] transition-colors ${
              m === month
                ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
                : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink)]"
            }`}
          >
            {MONTH_LABEL[m]}
          </Link>
        ))}
      </section>

      <section className="panel overflow-x-auto">
        <table className="grid">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Driver</th>
              <th className="num">Students</th>
              <th className="num">Expected</th>
              <th className="num">Collected</th>
              <th className="num">Commission</th>
              <th className="num">Net due</th>
              <th className="num">Paid</th>
              <th className="num">Balance</th>
              <th>Last paid</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <PayoutRow key={r.driver_id} rank={i + 1} fy={fy} month={month} row={r} />
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-10 text-center text-[var(--color-muted)]">
                  No active drivers.
                </td>
              </tr>
            ) : null}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr>
                <td className="text-[var(--color-muted-2)]" colSpan={3}>
                  Totals
                </td>
                <td className="num text-[var(--color-ink-2)]">
                  {formatINRCompact(totals.expected)}
                </td>
                <td className="num text-[var(--color-ink-2)]">
                  {formatINRCompact(totals.collected)}
                </td>
                <td className="num text-[var(--color-ink-2)]">
                  {formatINRCompact(totals.commission)}
                </td>
                <td className="num font-semibold text-[var(--color-ink)]">
                  {formatINRCompact(totals.due)}
                </td>
                <td className="num font-semibold text-[var(--color-positive)]">
                  {formatINRCompact(totals.paid)}
                </td>
                <td
                  className={`num font-semibold ${
                    balance > 0
                      ? "text-[var(--color-negative)]"
                      : balance < 0
                        ? "text-[var(--color-warn)]"
                        : "text-[var(--color-positive)]"
                  }`}
                  title={
                    balance < 0
                      ? `Drivers overpaid by ${formatINRCompact(-balance)} total`
                      : balance > 0
                        ? `${formatINRCompact(balance)} still owed`
                        : "Settled"
                  }
                >
                  {balance > 0
                    ? formatINRCompact(balance)
                    : balance < 0
                      ? `${formatINRCompact(-balance)} over`
                      : "Settled"}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </section>
    </div>
  );
}
