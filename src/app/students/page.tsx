import {
  listStudents,
  getDrivers,
  getSchools,
  getDistinctClasses,
  getYearlyPaymentsByStudent,
  type PaymentFilter,
  type StudentStatusFilter,
} from "@/lib/queries";
import {
  MONTHS,
  MONTH_LABEL,
  currentFiscalMonthIndex,
  currentFiscalYear,
  formatINR,
  monthYear,
  type MonthCode,
} from "@/lib/fiscal";
import Link from "next/link";
import { StudentFilters } from "./filters";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  school?: string;
  driverId?: string;
  klass?: string;
  status?: StudentStatusFilter;
  payment?: PaymentFilter;
  month?: string;
}>;

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const fy = currentFiscalYear();
  const ytd = sp.month === "ALL";
  const month: MonthCode | "ALL" = ytd
    ? "ALL"
    : sp.month && MONTHS.includes(sp.month as MonthCode)
      ? (sp.month as MonthCode)
      : MONTHS[currentFiscalMonthIndex()];
  const displayMonth: MonthCode = ytd
    ? MONTHS[currentFiscalMonthIndex()]
    : (month as MonthCode);

  const drivers = getDrivers();
  const schools = getSchools();
  const classes = getDistinctClasses();

  const rows = listStudents({
    q: sp.q || undefined,
    school: sp.school || undefined,
    driverId: sp.driverId ? Number(sp.driverId) : undefined,
    klass: sp.klass || undefined,
    status: sp.status ?? "ACTIVE",
    payment: sp.payment ?? "all",
    fy,
    month,
  });

  const monthlyByStudent = ytd
    ? getYearlyPaymentsByStudent(
        fy,
        rows.map((r) => r.id),
      )
    : null;

  const totals = rows.reduce(
    (acc, r) => {
      acc.fee += r.monthly_fee;
      acc.paid += r.paid_this_month ?? 0;
      return acc;
    },
    { fee: 0, paid: 0 },
  );

  return (
    <div className="space-y-8 fade-in">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label">Register</div>
          <h1 className="mt-2 font-display text-4xl font-normal tracking-tight">
            Students <em className="italic text-[var(--color-muted)]">({rows.length.toLocaleString("en-IN")})</em>
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-2)]">
            {ytd ? (
              <>
                <span className="font-display italic">
                  All twelve months
                </span>{" "}
                shown side-by-side. Partial payments appear in accent colour.
              </>
            ) : (
              <>
                Payment status shown for{" "}
                <span className="font-display italic">
                  {MONTH_LABEL[displayMonth]} {monthYear(fy, MONTHS.indexOf(displayMonth))}
                </span>
                .
              </>
            )}
          </p>
        </div>
        <div className="flex items-end gap-6">
          <div className="hidden items-baseline gap-6 text-right sm:flex">
            <div>
              <div className="label">Monthly fee</div>
              <div className="mt-1 font-display text-xl tabular">{formatINR(totals.fee)}</div>
            </div>
            <div>
              <div className="label">{ytd ? "YTD paid" : "This month"}</div>
              <div className="mt-1 font-display text-xl tabular text-[var(--color-positive)]">
                {formatINR(totals.paid)}
              </div>
            </div>
          </div>
          <Link href="/students/new" className="btn btn-accent">
            + New student
          </Link>
        </div>
      </header>

      <StudentFilters drivers={drivers} schools={schools} classes={classes} />

      <div className="card overflow-x-auto">
        <table className="ledger">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th>Name</th>
              <th>School</th>
              <th>Class</th>
              <th>Driver</th>
              <th>Route</th>
              <th className="num">Fee</th>
              {ytd ? (
                <>
                  {MONTHS.map((m) => (
                    <th key={m} className="num">
                      {MONTH_LABEL[m]}
                    </th>
                  ))}
                  <th className="num">YTD</th>
                </>
              ) : (
                <th className="num">{MONTH_LABEL[displayMonth]}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={ytd ? 20 : 8} className="py-16 text-center text-sm text-[var(--color-muted)]">
                  No students match those filters.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const paid = r.paid_this_month > 0;
                const perMonth = monthlyByStudent?.get(r.id);
                return (
                  <tr key={r.id}>
                    <td className="font-num text-[var(--color-muted-2)]">{i + 1}</td>
                    <td>
                      <Link
                        href={`/students/${r.id}`}
                        className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                      >
                        {r.name}
                      </Link>
                      {r.name_hindi ? (
                        <div className="text-xs text-[var(--color-muted)]">{r.name_hindi}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded border border-[var(--color-rule)] px-1.5 py-0.5 text-[0.68rem] font-medium tracking-[0.06em] text-[var(--color-ink-2)]">
                        {r.school}
                      </span>
                    </td>
                    <td className="text-[var(--color-ink-2)]">{r.class ?? "—"}</td>
                    <td>
                      <Link
                        href={`/drivers/${r.driver_id}/edit`}
                        className="text-[var(--color-ink-2)] hover:text-[var(--color-accent)]"
                      >
                        {r.driver}
                      </Link>
                    </td>
                    <td className="text-xs">
                      {r.route && r.route_id ? (
                        <Link
                          href={`/routes/${r.route_id}/edit`}
                          className="text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                        >
                          {r.route}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                    <td className="num font-num text-[var(--color-ink-2)]">{formatINR(r.monthly_fee)}</td>
                    {ytd ? (
                      <>
                        {MONTHS.map((m) => {
                          const amt = perMonth?.get(m);
                          const partial = amt != null && amt > 0 && amt < r.monthly_fee;
                          return (
                            <td
                              key={m}
                              className={`num font-num text-xs ${
                                amt == null
                                  ? "text-[var(--color-muted-2)]"
                                  : partial
                                    ? "text-[var(--color-accent)] font-semibold"
                                    : "text-[var(--color-success)]"
                              }`}
                              title={amt ? `${MONTH_LABEL[m]}: ${formatINR(amt)}` : undefined}
                            >
                              {amt == null ? "—" : amt.toLocaleString("en-IN")}
                            </td>
                          );
                        })}
                        <td className="num font-num font-medium text-[var(--color-ink)]">
                          {formatINR(r.paid_this_month)}
                        </td>
                      </>
                    ) : (
                      <td className="num">
                        {paid ? (
                          <span className="font-num text-[var(--color-success)]">
                            {formatINR(r.paid_this_month)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[0.7rem] font-medium text-[var(--color-accent)]">
                            Unpaid
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {ytd ? (
        <div className="text-[0.75rem] text-[var(--color-muted)]">
          Green = full monthly fee paid · orange = partial · dash = nothing recorded · hover a cell for details.
        </div>
      ) : null}
    </div>
  );
}
