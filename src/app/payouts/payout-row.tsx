import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DriverPayoutRow } from "@/lib/queries";
import { formatINR, type MonthCode } from "@/lib/fiscal";

// One read-only summary row per driver. Full per-payment editing lives on
// /payouts/[driverId]?month=XXX since a driver may now have many payments
// per month.
export function PayoutRow({
  rank,
  fy: _fy,
  month,
  row,
}: {
  rank: number;
  fy: number;
  month: MonthCode;
  row: DriverPayoutRow;
}) {
  const balance = row.net_due - row.total_paid;
  // Three distinct states:
  //   balance > 0  → driver still owed money  (red)
  //   balance = 0  → settled exactly          (green / "Settled")
  //   balance < 0  → driver was overpaid      (warn / "₹X over")
  const overpaid = balance < 0;
  const settled = balance === 0 && row.total_paid > 0;

  return (
    <tr>
      <td className="num text-[var(--color-muted-2)]">
        {String(rank).padStart(2, "0")}
      </td>
      <td>
        <Link
          href={`/payouts/${row.driver_id}?month=${month}`}
          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
        >
          {row.driver_name}
        </Link>
        {row.route_count > 1 ? (
          <span className="ml-2 text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            {row.route_count} routes
          </span>
        ) : null}
      </td>
      <td className="num text-[var(--color-ink-2)]">{row.active_students}</td>
      <td className="num text-[var(--color-muted)]">{formatINR(row.expected)}</td>
      <td className="num text-[var(--color-ink-2)]">{formatINR(row.collected)}</td>
      <td className="num text-[var(--color-muted)]">{formatINR(row.commission_amt)}</td>
      <td className="num font-semibold text-[var(--color-ink)]">
        {formatINR(row.net_due)}
      </td>
      <td className="num font-semibold text-[var(--color-positive)]">
        {formatINR(row.total_paid)}
        {row.payment_count > 1 ? (
          <span className="ml-1 text-[0.6875rem] font-normal uppercase tracking-[0.06em] text-[var(--color-muted)]">
            · {row.payment_count}×
          </span>
        ) : null}
      </td>
      <td
        className={`num font-medium ${
          balance > 0
            ? "text-[var(--color-negative)]"
            : overpaid
              ? "text-[var(--color-warn)]"
              : settled
                ? "text-[var(--color-positive)]"
                : "text-[var(--color-muted)]"
        }`}
        title={
          overpaid
            ? `Overpaid by ${formatINR(-balance)}`
            : balance > 0
              ? `${formatINR(balance)} still owed to driver`
              : settled
                ? "Settled"
                : undefined
        }
      >
        {balance > 0
          ? formatINR(balance)
          : overpaid
            ? `${formatINR(-balance)} over`
            : settled
              ? "Settled"
              : "—"}
      </td>
      <td className="text-[0.75rem] text-[var(--color-muted)]">
        {row.last_paid_on ?? "—"}
      </td>
      <td>
        <Link
          href={`/payouts/${row.driver_id}?month=${month}`}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-rule)] px-3 py-1 text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-2)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
          aria-label={`Open payments for ${row.driver_name}`}
        >
          Open <ArrowRight size={11} />
        </Link>
      </td>
    </tr>
  );
}
