import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, MapPin, User as UserIcon, Pencil } from "lucide-react";
import { getStudent, getStudentPayments } from "@/lib/queries";
import {
  MONTHS,
  MONTH_LABEL,
  academicLabel,
  currentFiscalMonthIndex,
  currentFiscalYear,
  formatINR,
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

  const totalPaid = monthly.reduce((a, r) => a + (r.amount ?? 0), 0);
  const expected = student.monthly_fee * (curIdx + 1);
  const unpaid = monthly.filter(
    (r) => !r.is_future && (r.amount ?? 0) === 0,
  ).length;
  const pct = expected > 0 ? (totalPaid / expected) * 100 : 0;

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

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--color-rule)] pt-5">
            <div>
              <div className="label">YTD paid</div>
              <div className="mt-1 font-display text-lg text-[var(--color-success)]">
                {formatINR(totalPaid)}
              </div>
            </div>
            <div>
              <div className="label">YTD due</div>
              <div className="mt-1 font-display text-lg">
                {formatINR(expected)}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between text-[0.7rem] uppercase tracking-[0.12em] text-[var(--color-muted)]">
              <span>Progress</span>
              <span className="tabular">{pct.toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-rule-soft)]">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, pct)}%`,
                  background: pct >= 95 ? "var(--color-success)" : "var(--color-ink)",
                }}
              />
            </div>
          </div>

          {unpaid > 0 ? (
            <div className="mt-5 rounded-md border border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)]/60 px-3 py-2 text-xs text-[var(--color-accent-2)]">
              <span className="font-display text-sm">{unpaid}</span> month
              {unpaid !== 1 ? "s" : ""} unpaid
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
          />
        </div>
      </section>
    </div>
  );
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
