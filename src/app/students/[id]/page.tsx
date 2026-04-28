import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, MapPin, User as UserIcon, Pencil } from "lucide-react";
import {
  getStudent,
  getStudentPayments,
  getStudentPaymentHistory,
  type StudentPaymentLogRow,
} from "@/lib/queries";
import {
  MONTHS,
  MONTH_LABEL,
  academicLabel,
  currentFiscalMonthIndex,
  currentFiscalYear,
  enrollmentLabel,
  formatINR,
  isMonthActive,
  monthsInRange,
  type MonthCode,
} from "@/lib/fiscal";
import { MonthlyGrid } from "./monthly-grid";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function StudentDetailPage({ params }: { params: Params }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const fy = currentFiscalYear();
  const curIdx = currentFiscalMonthIndex();
  const student = getStudent(id);
  if (!student) notFound();

  const payments = getStudentPayments(id, fy);
  const history = getStudentPaymentHistory(id);

  const monthly = MONTHS.map((m, i) => {
    const p = payments.get(m);
    return {
      month: m as MonthCode,
      index: i,
      amount: p?.amount_paid ?? null,
      paid_on: p?.paid_on ?? null,
      mode: p?.mode ?? null,
      is_current: i === curIdx,
      is_future: i > curIdx,
    };
  });

  // Per-student enrollment window. NULL bounds default to APR / MAR (full
  // year). A student joining in JUL or leaving in OCT is only billed for
  // the months their window covers.
  const enrolled = monthsInRange(student.start_month, student.end_month);
  const enrolledElapsed = enrolled.filter(
    (m) => MONTHS.indexOf(m) <= curIdx,
  );
  const totalPaid = monthly.reduce((a, r) => a + (r.amount ?? 0), 0);
  const annualFee = student.monthly_fee * enrolled.length;
  const ytdDue = student.monthly_fee * enrolledElapsed.length;
  const ytdPaid = monthly
    .filter(
      (r) =>
        MONTHS.indexOf(r.month) <= curIdx &&
        isMonthActive(r.month, student.start_month, student.end_month),
    )
    .reduce((a, r) => a + (r.amount ?? 0), 0);
  // "Outstanding" = how much of the annual fee hasn't been paid yet.
  // "Overdue" = how much was due through the current month (within the
  // student's enrollment window) but not paid.
  const outstanding = Math.max(0, annualFee - totalPaid);
  const overdueAmt = Math.max(0, ytdDue - ytdPaid);
  const unpaid = monthly.filter(
    (r) =>
      !r.is_future &&
      (r.amount ?? 0) === 0 &&
      isMonthActive(r.month, student.start_month, student.end_month),
  ).length;
  const pct = annualFee > 0 ? (totalPaid / annualFee) * 100 : 0;

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-center justify-between">
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft size={12} /> All students
        </Link>
        <Link href={`/students/${id}/edit`} className="btn btn-ghost">
          <Pencil size={12} /> Edit
        </Link>
      </div>

      <header className="grid gap-6 border-b border-[var(--color-rule)] pb-6 sm:pb-8 md:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="label">
            {student.school_code} · Class {student.class ?? "—"} · AY{" "}
            {academicLabel(fy)}
          </div>
          <h1 className="mt-2 font-display text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">
            {student.name}
          </h1>
          {student.name_hindi ? (
            <div className="mt-1 text-xl text-[var(--color-muted)] sm:text-2xl">
              {student.name_hindi}
            </div>
          ) : null}

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:mt-8 sm:gap-x-10 sm:gap-y-5">
            <DetailRow
              icon={<UserIcon size={14} />}
              label="Driver"
              value={student.driver_name}
              sub={`${student.commission_percent}% commission`}
              href={`/drivers/${student.driver_id}/edit`}
            />
            <DetailRow
              label="Route"
              value={student.route_name ?? "—"}
              sub={student.route_code ?? undefined}
              href={
                student.route_id
                  ? `/routes/${student.route_id}/edit`
                  : undefined
              }
            />
            <DetailRow
              icon={<Phone size={14} />}
              label="Contact"
              value={student.contact ?? "—"}
            />
            <DetailRow
              icon={<MapPin size={14} />}
              label="Pickup address"
              value={student.pickup_address ?? "—"}
            />
            <DetailRow
              label="Vehicle"
              value={student.vehicle_plate ?? "—"}
            />
            <DetailRow label="Status" value={student.status} />
          </dl>
        </div>

        <aside className="card p-6">
          <div className="label">Monthly fee</div>
          <div className="mt-2 font-display text-4xl tracking-tight">
            {formatINR(student.monthly_fee)}
          </div>
          <div className="mt-1 text-[0.75rem] text-[var(--color-muted)]">
            Active: {enrollmentLabel(student.start_month, student.end_month)}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--color-rule)] pt-5">
            <div>
              <div className="label">Paid</div>
              <div className="mt-1 font-display text-lg text-[var(--color-success)]">
                {formatINR(totalPaid)}
              </div>
              <div className="mt-0.5 text-[0.7rem] text-[var(--color-muted)]">
                of {formatINR(annualFee)} annual
              </div>
            </div>
            <div>
              <div className="label">
                {outstanding > 0 ? "Outstanding" : "Status"}
              </div>
              <div
                className={`mt-1 font-display text-lg ${
                  outstanding > 0
                    ? "text-[var(--color-negative)]"
                    : "text-[var(--color-success)]"
                }`}
              >
                {outstanding > 0 ? formatINR(outstanding) : "Fully paid"}
              </div>
              <div className="mt-0.5 text-[0.7rem] text-[var(--color-muted)]">
                {overdueAmt > 0
                  ? `${formatINR(overdueAmt)} overdue`
                  : `Through ${MONTH_LABEL[MONTHS[curIdx]]}: paid up`}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between text-[0.7rem] uppercase tracking-[0.12em] text-[var(--color-muted)]">
              <span>Annual progress</span>
              <span className="tabular">{Math.min(100, pct).toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-rule-soft)]">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, pct)}%`,
                  background:
                    pct >= 100
                      ? "var(--color-success)"
                      : "var(--color-ink)",
                }}
              />
            </div>
          </div>

          {overdueAmt > 0 ? (
            <div className="mt-5 rounded-md border border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)]/60 px-3 py-2 text-xs text-[var(--color-accent-2)]">
              <span className="font-display text-sm">{unpaid}</span> month
              {unpaid !== 1 ? "s" : ""} unpaid through {MONTH_LABEL[MONTHS[curIdx]]}
            </div>
          ) : null}
        </aside>
      </header>

      <section>
        <div className="flex items-end justify-between">
          <div>
            <div className="label">Twelve-month ledger</div>
            <h2 className="mt-1 font-display text-2xl tracking-tight">
              Click a cell to <em className="italic">enter or edit</em>
            </h2>
          </div>
        </div>
        <div className="mt-5">
          <MonthlyGrid
            studentId={id}
            fy={fy}
            fee={student.monthly_fee}
            months={monthly}
            startMonth={student.start_month}
            endMonth={student.end_month}
          />
        </div>
      </section>

      <PaymentHistory history={history} />
    </div>
  );
}

function PaymentHistory({ history }: { history: StudentPaymentLogRow[] }) {
  if (history.length === 0) {
    return (
      <section>
        <div className="label">Payment history</div>
        <h2 className="mt-1 font-display text-2xl tracking-tight">
          No payments recorded yet
        </h2>
      </section>
    );
  }

  const total = history.reduce((sum, r) => sum + (r.amount_paid ?? 0), 0);

  return (
    <section>
      <div className="flex items-end justify-between">
        <div>
          <div className="label">Payment history</div>
          <h2 className="mt-1 font-display text-2xl tracking-tight">
            {history.length} payment{history.length === 1 ? "" : "s"}{" "}
            <span className="font-display text-[var(--color-muted)]">
              · {formatINR(total)} total
            </span>
          </h2>
        </div>
      </div>
      <div className="card mt-5 overflow-x-auto">
        <table className="grid">
          <thead>
            <tr>
              <th>Paid on</th>
              <th>For</th>
              <th className="num">Amount</th>
              <th>Mode</th>
              <th>Notes</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap font-medium text-[var(--color-ink)]">
                  {formatPaidOn(r.paid_on)}
                </td>
                <td className="whitespace-nowrap">
                  <span className="mono text-[0.6875rem] uppercase tracking-[0.08em]">
                    {MONTH_LABEL[r.month_code]} {r.fiscal_year}
                  </span>
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
                  {r.notes ?? <span className="text-[var(--color-muted-2)]">—</span>}
                </td>
                <td
                  className="whitespace-nowrap text-[0.8125rem] text-[var(--color-muted)]"
                  title={r.entered_at ? `Saved at ${formatEnteredAt(r.entered_at)}` : undefined}
                >
                  {r.entered_by_name ?? "—"}
                  {r.entered_at ? (
                    <span className="ml-2 text-[var(--color-muted-2)]">
                      {formatRelativeOrDate(r.entered_at)}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatPaidOn(s: string | null): string {
  if (!s) return "—";
  // Most payments are stored as ISO YYYY-MM-DD; some legacy rows from the
  // initial xlsx import are YYYY-MMM-DD (e.g. "2026-MAY-01"). Handle both.
  const monthMap: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };
  const mmm = s.match(/^(\d{4})-([A-Z]{3})-(\d{2})$/);
  const iso = mmm ? `${mmm[1]}-${monthMap[mmm[2]] ?? "01"}-${mmm[3]}` : s;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatEnteredAt(s: string): string {
  // entered_at is "YYYY-MM-DD HH:MM:SS" from datetime('now') (UTC).
  const d = new Date(s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeOrDate(s: string): string {
  const d = new Date(s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function DetailRow({
  icon,
  label,
  value,
  sub,
  href,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  href?: string;
}) {
  return (
    <div>
      <dt className="label flex items-center gap-1.5">
        {icon ? <span className="text-[var(--color-muted-2)]">{icon}</span> : null}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[var(--color-ink)]">
        {href ? (
          <Link
            href={href}
            className="underline decoration-[var(--color-rule)] decoration-1 underline-offset-[3px] transition-colors hover:decoration-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
      {sub ? (
        <div className="mt-0.5 text-[0.7rem] uppercase tracking-[0.1em] text-[var(--color-muted)]">
          {sub}
        </div>
      ) : null}
    </div>
  );
}
