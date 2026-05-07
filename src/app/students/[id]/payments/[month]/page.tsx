import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getStudent,
  getStudentInstallments,
  getStudentPayments,
} from "@/lib/queries";
import {
  MONTHS,
  MONTH_LABEL,
  academicLabel,
  currentFiscalYear,
  formatINR,
  isMonthActive,
  type MonthCode,
} from "@/lib/fiscal";
import { InstallmentList } from "./installment-list";
import { AddInstallmentForm } from "./add-installment-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; month: string }>;

export default async function StudentMonthPaymentsPage({
  params,
}: {
  params: Params;
}) {
  const { id: idStr, month: monthStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const month = monthStr.toUpperCase() as MonthCode;
  if (!(MONTHS as readonly string[]).includes(month)) notFound();

  const student = getStudent(id);
  if (!student) notFound();

  const fy = currentFiscalYear();
  const installments = getStudentInstallments(id, fy, month);
  const totalPaid = installments.reduce((a, r) => a + (r.amount_paid ?? 0), 0);
  const remaining = Math.max(0, student.monthly_fee - totalPaid);

  // Per-month status for the navigator strip — lets the user jump to any
  // month without bouncing back to the student detail page.
  const allMonthTotals = getStudentPayments(id, fy);
  const monthIdx = MONTHS.indexOf(month);
  const prevMonth = monthIdx > 0 ? MONTHS[monthIdx - 1] : null;
  const nextMonth = monthIdx < MONTHS.length - 1 ? MONTHS[monthIdx + 1] : null;

  return (
    <div className="space-y-8 fade-in">
      <div>
        <Link
          href={`/students/${id}`}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft size={12} /> Back to student
        </Link>
      </div>

      <section className="panel px-4 py-5 sm:px-7 sm:py-7">
        <div className="label">
          {student.school_code} · {academicLabel(fy)} · {MONTH_LABEL[month]}
        </div>
        <h1 className="mt-3 text-[1.75rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)] sm:text-[2.5rem]">
          {student.name}
          <span className="serif text-[1.75rem] text-[var(--color-accent)] sm:text-[2.5rem]">
            {" "}/ {MONTH_LABEL[month]}
          </span>
        </h1>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          <Stat label="Monthly fee" value={formatINR(student.monthly_fee)} />
          <Stat
            label="Paid"
            value={formatINR(totalPaid)}
            tone={totalPaid >= student.monthly_fee ? "positive" : totalPaid > 0 ? "warn" : "muted"}
            sub={`${installments.length} installment${installments.length === 1 ? "" : "s"}`}
          />
          <Stat
            label="Remaining"
            value={remaining > 0 ? formatINR(remaining) : "—"}
            tone={remaining > 0 ? "negative" : "positive"}
          />
          <Stat
            label="Status"
            value={
              totalPaid >= student.monthly_fee
                ? "Paid up"
                : totalPaid > 0
                  ? "Partial"
                  : "Unpaid"
            }
            tone={
              totalPaid >= student.monthly_fee
                ? "positive"
                : totalPaid > 0
                  ? "warn"
                  : "negative"
            }
          />
        </div>
      </section>

      <section className="panel flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="label mr-1 hidden sm:inline">Jump to month</span>
        {prevMonth ? (
          <Link
            href={`/students/${id}/payments/${prevMonth}`}
            className="mono inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-sm border border-[var(--color-rule)] px-2 text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink)]"
            aria-label={`Previous month — ${MONTH_LABEL[prevMonth]}`}
          >
            <ChevronLeft size={12} /> {MONTH_LABEL[prevMonth]}
          </Link>
        ) : null}
        {MONTHS.map((m) => {
          const totals = allMonthTotals.get(m);
          const total = totals?.amount_paid ?? 0;
          const enrolled = isMonthActive(m, student.start_month, student.end_month);
          const isCurrent = m === month;
          const dotColor =
            !enrolled
              ? "bg-[var(--color-muted-2)]"
              : total >= student.monthly_fee
                ? "bg-[var(--color-positive)]"
                : total > 0
                  ? "bg-[var(--color-warn)]"
                  : "bg-[var(--color-negative)]";
          return (
            <Link
              key={m}
              href={`/students/${id}/payments/${m}`}
              className={`mono inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 text-[0.6875rem] uppercase tracking-[0.06em] transition-colors ${
                isCurrent
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
                  : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink)]"
              } ${!enrolled ? "opacity-50" : ""}`}
              title={
                !enrolled
                  ? "Not enrolled"
                  : total > 0
                    ? `${formatINR(total)} paid`
                    : "Unpaid"
              }
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
              {MONTH_LABEL[m]}
            </Link>
          );
        })}
        {nextMonth ? (
          <Link
            href={`/students/${id}/payments/${nextMonth}`}
            className="mono inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-sm border border-[var(--color-rule)] px-2 text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink)]"
            aria-label={`Next month — ${MONTH_LABEL[nextMonth]}`}
          >
            {MONTH_LABEL[nextMonth]} <ChevronRight size={12} />
          </Link>
        ) : null}
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-end justify-between border-b border-[var(--color-rule)] px-5 py-4">
          <div>
            <div className="label">Installments</div>
            <h2 className="mt-1 mono text-[0.9375rem] font-semibold uppercase tracking-[0.04em]">
              {installments.length} recorded · {formatINR(totalPaid)}
            </h2>
          </div>
        </div>
        <InstallmentList
          studentId={id}
          fy={fy}
          month={month}
          installments={installments}
        />
      </section>

      <section>
        <div className="label">Add installment</div>
        <h2 className="mt-1 font-display text-[1.5rem] tracking-tight">
          Record a new payment for {MONTH_LABEL[month]}
        </h2>
        <p className="mt-1 text-[0.875rem] text-[var(--color-ink-2)]">
          Each entry creates a new row. Use this for partial payments,
          installments, or back-corrections.
        </p>
        <AddInstallmentForm
          studentId={id}
          fy={fy}
          month={month}
          monthlyFee={student.monthly_fee}
          remaining={remaining}
        />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative" | "warn" | "muted" | "ink";
}) {
  const valueColor =
    tone === "positive"
      ? "text-[var(--color-positive)]"
      : tone === "negative"
        ? "text-[var(--color-negative)]"
        : tone === "warn"
          ? "text-[var(--color-warn)]"
          : tone === "muted"
            ? "text-[var(--color-muted)]"
            : "text-[var(--color-ink)]";
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`num mt-1 text-[1.375rem] font-medium leading-none ${valueColor}`}>
        {value}
      </div>
      {sub ? (
        <div className="mt-1 text-[0.75rem] text-[var(--color-muted)]">{sub}</div>
      ) : null}
    </div>
  );
}
