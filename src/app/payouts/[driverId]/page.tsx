import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getDriver,
  getDriverPayouts,
  getDriverPaymentLog,
} from "@/lib/queries";
import {
  MONTHS,
  MONTH_LABEL,
  academicLabel,
  currentFiscalMonthIndex,
  currentFiscalYear,
  formatINR,
  type MonthCode,
} from "@/lib/fiscal";
import { PaymentList } from "./payment-list";
import { AddPaymentForm } from "./add-payment-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ driverId: string }>;
type Search = Promise<{ month?: string }>;

export default async function DriverPayoutPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { driverId: driverIdStr } = await params;
  const driverId = Number(driverIdStr);
  if (!Number.isFinite(driverId)) notFound();

  const sp = await searchParams;
  const fy = currentFiscalYear();
  const month: MonthCode =
    sp.month && MONTHS.includes(sp.month as MonthCode)
      ? (sp.month as MonthCode)
      : MONTHS[currentFiscalMonthIndex()];

  const driver = getDriver(driverId);
  if (!driver) notFound();

  const summary = getDriverPayouts(fy, month).find((d) => d.driver_id === driverId);
  const payments = getDriverPaymentLog(fy, month, driverId);

  // If a driver has no active students this month, getDriverPayouts may still
  // surface them (they're in the drivers table). Provide safe defaults.
  const expected = summary?.expected ?? 0;
  const collected = summary?.collected ?? 0;
  const commissionAmt = summary?.commission_amt ?? 0;
  const netDue = summary?.net_due ?? 0;
  const totalPaid = summary?.total_paid ?? 0;
  const balance = netDue - totalPaid;

  return (
    <div className="space-y-6 fade-in">
      <div>
        <Link
          href={`/payouts?month=${month}`}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft size={12} /> All payouts
        </Link>
      </div>

      <section className="panel px-4 py-5 sm:px-7 sm:py-7">
        <div className="label">
          Payout · {academicLabel(fy)} · {driver.commission_percent}% commission
        </div>
        <h1 className="mt-3 text-[1.75rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)] sm:text-[2.5rem]">
          {driver.name}
          <span className="serif text-[1.75rem] text-[var(--color-accent)] sm:text-[2.5rem]">
            {" "}/ {MONTH_LABEL[month]}
          </span>
        </h1>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <Cell label="Expected" value={formatINR(expected)} muted />
          <Cell label="Collected" value={formatINR(collected)} />
          <Cell label="Commission" value={formatINR(commissionAmt)} muted />
          <Cell label="Net due" value={formatINR(netDue)} strong />
          <Cell label="Paid" value={formatINR(totalPaid)} positive />
          <Cell
            label="Balance"
            value={
              balance > 0
                ? `${formatINR(balance)} owed`
                : balance < 0
                  ? `${formatINR(-balance)} overpaid`
                  : "Settled"
            }
            tone={
              balance > 0 ? "negative" : balance < 0 ? "warn" : "positive"
            }
            strong
          />
        </dl>
      </section>

      <section className="panel flex flex-wrap items-center gap-1 px-4 py-3">
        <span className="label mr-2">MONTH</span>
        {MONTHS.map((m) => (
          <Link
            key={m}
            href={`/payouts/${driverId}?month=${m}`}
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

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="label">Payments · {MONTH_LABEL[month]}</div>
            <h2 className="mt-1 mono text-[0.9375rem] font-semibold uppercase tracking-[0.04em]">
              {payments.length} {payments.length === 1 ? "entry" : "entries"} · paid {formatINR(totalPaid)}
            </h2>
          </div>
        </div>
        <PaymentList payments={payments} />
      </section>

      <section className="space-y-3">
        <div>
          <div className="label">Record payment</div>
          <h2 className="mt-1 mono text-[0.9375rem] font-semibold uppercase tracking-[0.04em]">
            Add a new payment to this month
          </h2>
        </div>
        <AddPaymentForm
          driverId={driverId}
          fy={fy}
          month={month}
          suggestedAmount={Math.max(0, balance)}
        />
      </section>
    </div>
  );
}

function Cell({
  label,
  value,
  muted,
  strong,
  positive,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  positive?: boolean;
  tone?: "negative" | "positive" | "warn";
}) {
  const cls = tone === "negative"
    ? "text-[var(--color-negative)]"
    : tone === "warn"
      ? "text-[var(--color-warn)]"
      : tone === "positive" || positive
        ? "text-[var(--color-positive)]"
        : muted
          ? "text-[var(--color-muted)]"
          : "text-[var(--color-ink)]";
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`num mt-1 text-[1.125rem] ${strong ? "font-semibold" : "font-medium"} ${cls}`}>
        {value}
      </div>
    </div>
  );
}
