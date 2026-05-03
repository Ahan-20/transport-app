import { notFound } from "next/navigation";
import { getDriverRoster, getPaymentsForStudents } from "@/lib/queries";
import {
  MONTHS,
  MONTH_LABEL,
  academicLabel,
  currentFiscalYear,
  type MonthCode,
} from "@/lib/fiscal";
import { PaymentEntryTable } from "./entry-table";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

type Params = Promise<{ driverId: string; month: string }>;

export default async function PaymentEntryPage({ params }: { params: Params }) {
  const { driverId: driverIdStr, month: monthStr } = await params;
  const driverId = Number(driverIdStr);
  const month = monthStr.toUpperCase() as MonthCode;
  if (!MONTHS.includes(month) || !Number.isFinite(driverId)) notFound();

  const fy = currentFiscalYear();
  const data = getDriverRoster(driverId);
  if (!data) notFound();

  const { driver, students } = data;
  const ids = students.map((s) => s.id);
  const payments = getPaymentsForStudents(ids, fy, month);

  const initial = students.map((s) => {
    const p = payments.get(s.id);
    return {
      id: s.id,
      sno: s.sno,
      name: s.name,
      name_hindi: s.name_hindi,
      class: s.class,
      school: s.school,
      route: s.route_name,
      route_code: s.route_code,
      fee: s.monthly_fee,
      contact: s.contact,
      start_month: s.start_month,
      end_month: s.end_month,
      amount: p?.amount ?? null,
      paid_on: p?.paid_on ?? null,
      mode: p?.mode ?? null,
      installment_count: p?.installment_count ?? 0,
    };
  });

  const prevIdx = MONTHS.indexOf(month);
  const prev = prevIdx > 0 ? MONTHS[prevIdx - 1] : null;
  const next = prevIdx < MONTHS.length - 1 ? MONTHS[prevIdx + 1] : null;

  return (
    <div className="space-y-8 fade-in">
      <div className="print:hidden">
        <Link
          href="/payments"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft size={12} /> All drivers
        </Link>
      </div>

      <section className="panel px-4 py-5 print:hidden sm:px-7 sm:py-7">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-8">
          <div>
            <div className="label">
              Entry · {academicLabel(fy)} · {driver.commission_percent}% commission
            </div>
            <h1 className="mt-3 text-[1.75rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)] sm:text-[2.5rem]">
              {driver.name}
              <span className="serif text-[1.75rem] text-[var(--color-accent)] sm:text-[2.5rem]">
                {" "}/ {MONTH_LABEL[month]}
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-[0.875rem] leading-relaxed text-[var(--color-ink-2)] sm:mt-4 sm:text-[0.9375rem]">
              <span className="font-semibold text-[var(--color-ink)]">
                {students.length} students.
              </span>{" "}
              <span className="hidden sm:inline">
                Tab between rows, <span className="kbd">S</span> pays full fee,{" "}
                <span className="kbd">0</span> clears, <span className="kbd">⌘ S</span> saves.
              </span>
              <span className="sm:hidden">
                Tap a cell to enter the amount.
              </span>
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {prev ? (
              <Link
                href={`/payments/${driver.id}/${prev}`}
                className="btn btn-ghost flex-1 justify-center sm:flex-initial"
              >
                ← {MONTH_LABEL[prev]}
              </Link>
            ) : null}
            {next ? (
              <Link
                href={`/payments/${driver.id}/${next}`}
                className="btn btn-ghost flex-1 justify-center sm:flex-initial"
              >
                {MONTH_LABEL[next]} →
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <PaymentEntryTable
        driverId={driver.id}
        driverName={driver.name}
        commissionPercent={driver.commission_percent}
        fy={fy}
        month={month}
        initial={initial}
      />
    </div>
  );
}
