import Link from "next/link";
import { getPendingStudents } from "@/lib/queries";
import {
  MONTHS,
  MONTH_LABEL,
  academicLabel,
  currentFiscalMonthIndex,
  currentFiscalYear,
  formatINR,
  formatINRCompact,
} from "@/lib/fiscal";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; school?: string; driver?: string }>;
}) {
  const sp = await searchParams;
  const fy = currentFiscalYear();
  const mIdx = currentFiscalMonthIndex();
  const month = (sp.month && MONTHS.includes(sp.month as (typeof MONTHS)[number])
    ? (sp.month as (typeof MONTHS)[number])
    : MONTHS[mIdx]);

  const rows = getPendingStudents(fy, month);
  const filterSchool = sp.school;
  const filterDriver = sp.driver;

  const filtered = rows.filter((r) => {
    if (filterSchool && r.school !== filterSchool) return false;
    if (filterDriver && r.driver !== filterDriver) return false;
    return true;
  });

  const totals = filtered.reduce(
    (a, r) => ({
      count: a.count + 1,
      monthly: a.monthly + r.monthly_fee,
      outstanding: a.outstanding + r.outstanding_ytd,
      months: a.months + r.unpaid_months,
    }),
    { count: 0, monthly: 0, outstanding: 0, months: 0 },
  );

  const distinctDrivers = [...new Set(rows.map((r) => r.driver))].sort();

  return (
    <div className="space-y-6 fade-in">
      <section className="panel px-5 py-5 print:hidden">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="label">BLOCK · PENDING // {academicLabel(fy)}</div>
            <h1 className="mt-2 font-mono text-[1.9rem] font-semibold leading-[1] tracking-[-0.01em] text-[var(--color-ink)]">
              UNPAID&nbsp;/&nbsp;<span className="text-[var(--color-accent)]">{MONTH_LABEL[month].toUpperCase()}</span>
            </h1>
            <p className="mt-3 max-w-lg text-[0.8125rem] leading-relaxed text-[var(--color-ink-2)]">
              <span className="num font-semibold text-[var(--color-ink)]">{totals.count}</span> students
              with nothing recorded for {MONTH_LABEL[month]}. Outstanding YTD{" "}
              <span className="num font-semibold text-[var(--color-negative)]">
                {formatINR(totals.outstanding)}
              </span>.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="hidden items-stretch gap-0 sm:flex">
              <PillStat label="OPEN" value={totals.count.toLocaleString("en-IN")} />
              <PillStat label="MONTHLY" value={formatINRCompact(totals.monthly)} />
              <PillStat label="YTD · DUE" value={formatINRCompact(totals.outstanding)} tone="negative" />
            </div>
            <PrintButton />
          </div>
        </div>
      </section>

      {/* Print-only header — paper version. */}
      <section className="hidden print:block">
        <h1 className="text-2xl font-semibold">
          Pending — {MONTH_LABEL[month]} {fy}
          {filterDriver ? ` · Driver: ${filterDriver}` : ""}
          {filterSchool ? ` · School: ${filterSchool}` : ""}
        </h1>
        <p className="mt-1 text-sm">
          {totals.count} students · monthly {formatINR(totals.monthly)} · outstanding YTD {formatINR(totals.outstanding)}
        </p>
      </section>

      <section className="panel flex flex-wrap items-center gap-2 px-4 py-3 print:hidden">
        <span className="label mr-2">FILTER</span>
        <MonthChips current={month} />
        <span className="h-5 w-px bg-[var(--color-rule)]" />
        <SchoolChips current={filterSchool} month={month} />
        <span className="h-5 w-px bg-[var(--color-rule)]" />
        <DriverSelect drivers={distinctDrivers} current={filterDriver} month={month} school={filterSchool} />
        {(filterSchool || filterDriver) ? (
          <Link
            href={`/pending?month=${month}`}
            className="mono ml-auto text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            × CLEAR
          </Link>
        ) : null}
      </section>

      <section className="panel overflow-x-auto print:overflow-visible print:border-0">
        {/* Every column is left-aligned and capped to a tight width so each
            header sits directly above its value. Right-aligned money columns
            were drifting from their headers when the auto-layout grew the
            column wider than the value text. */}
        <table className="grid">
          <thead>
            <tr>
              <th className="w-12 whitespace-nowrap">#</th>
              <th className="whitespace-nowrap">Student</th>
              <th className="w-16 whitespace-nowrap">School</th>
              <th className="w-14 whitespace-nowrap">Class</th>
              <th className="w-40 whitespace-nowrap">Driver</th>
              <th className="hidden w-40 whitespace-nowrap lg:table-cell print:table-cell">Route</th>
              <th className="hidden w-32 whitespace-nowrap md:table-cell print:table-cell">Contact</th>
              <th className="w-24 whitespace-nowrap">Monthly</th>
              <th className="w-24 whitespace-nowrap">Due</th>
              <th className="w-20 whitespace-nowrap">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id}>
                <td className="tabular-nums text-[var(--color-muted-2)]">
                  {String(i + 1).padStart(3, "0")}
                </td>
                <td>
                  <Link
                    href={`/students/${s.id}`}
                    className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                  >
                    {s.name}
                  </Link>
                  {s.name_hindi ? (
                    <span className="ml-2 text-[var(--color-muted)]">{s.name_hindi}</span>
                  ) : null}
                  {/* Phone shows under name on phones — Contact column is hidden < md.
                      Hidden on print since the Contact column is forced visible there. */}
                  {s.contact ? (
                    <a
                      href={`tel:${s.contact}`}
                      className="mt-0.5 block text-[0.7rem] text-[var(--color-muted)] hover:text-[var(--color-accent)] md:hidden print:hidden"
                    >
                      ☎ {s.contact}
                    </a>
                  ) : null}
                </td>
                <td>
                  <span className="chip">{s.school}</span>
                </td>
                <td className="text-[var(--color-ink-2)]">{s.class ?? "—"}</td>
                <td>
                  <Link
                    href={`/drivers/${s.driver_id}/edit`}
                    className="text-[var(--color-ink-2)] hover:text-[var(--color-accent)]"
                  >
                    {s.driver}
                  </Link>
                </td>
                <td className="hidden lg:table-cell print:table-cell">
                  {s.route && s.route_id ? (
                    <Link
                      href={`/routes/${s.route_id}/edit`}
                      className="text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                    >
                      {s.route}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-muted)]">—</span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap text-[0.8125rem] text-[var(--color-ink-2)] md:table-cell print:table-cell">
                  {s.contact ? (
                    <a
                      href={`tel:${s.contact}`}
                      className="hover:text-[var(--color-accent)]"
                    >
                      {s.contact}
                    </a>
                  ) : (
                    <span className="text-[var(--color-muted-2)]">—</span>
                  )}
                </td>
                <td className="tabular-nums text-[var(--color-muted)]">
                  {formatINR(s.monthly_fee)}
                </td>
                <td className="tabular-nums font-semibold text-[var(--color-negative)]">
                  {formatINR(s.outstanding_ytd)}
                </td>
                <td>
                  <span
                    className={`chip ${
                      s.unpaid_months >= 3
                        ? "chip-negative"
                        : s.unpaid_months >= 1
                          ? "chip-warn"
                          : "chip-positive"
                    }`}
                  >
                    {s.unpaid_months} MO
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-[var(--color-muted)]">
                  <span className="mono text-[0.75rem] uppercase tracking-[0.08em]">
                    — NO UNPAID STUDENTS MATCH THESE FILTERS —
                  </span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MonthChips({ current }: { current: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {MONTHS.map((m) => (
        <Link
          key={m}
          href={`/pending?month=${m}`}
          className={`mono inline-flex h-7 items-center whitespace-nowrap rounded-sm border px-2 text-[0.6875rem] uppercase tracking-[0.06em] transition-colors ${
            m === current
              ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
              : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink)]"
          }`}
        >
          {MONTH_LABEL[m]}
        </Link>
      ))}
    </div>
  );
}

function SchoolChips({ current, month }: { current?: string; month: string }) {
  const schools = [
    { code: "SWS", label: "SWS" },
    { code: "SA", label: "SA" },
  ];
  return (
    <div className="flex items-center gap-1">
      {schools.map((s) => (
        <Link
          key={s.code}
          href={`/pending?month=${month}${current === s.code ? "" : `&school=${s.code}`}`}
          className={`mono inline-flex h-7 items-center whitespace-nowrap rounded-sm border px-2 text-[0.6875rem] uppercase tracking-[0.06em] transition-colors ${
            current === s.code
              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
              : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink)]"
          }`}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}

function DriverSelect({
  drivers,
  current,
  month,
  school,
}: {
  drivers: string[];
  current?: string;
  month: string;
  school?: string;
}) {
  const base = `/pending?month=${month}${school ? `&school=${school}` : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link
        href={base}
        className={`mono inline-flex h-7 items-center whitespace-nowrap rounded-sm border px-2 text-[0.6875rem] uppercase tracking-[0.06em] ${
          !current
            ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
            : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink)]"
        }`}
      >
        ALL DRIVERS
      </Link>
      {drivers.map((d) => (
        <Link
          key={d}
          href={`${base}&driver=${encodeURIComponent(d)}`}
          className={`mono inline-flex h-7 items-center whitespace-nowrap rounded-sm border px-2 text-[0.6875rem] uppercase tracking-[0.06em] transition-colors ${
            d === current
              ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
              : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink)]"
          }`}
        >
          {d}
        </Link>
      ))}
    </div>
  );
}

function PillStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "negative";
}) {
  return (
    <div className="flex flex-col items-end justify-center border-l border-[var(--color-rule)] px-4">
      <div
        className={`mono text-[0.625rem] uppercase tracking-[0.08em] ${
          tone === "negative" ? "text-[var(--color-negative)]" : "text-[var(--color-muted)]"
        }`}
      >
        {label}
      </div>
      <div
        className={`num mt-1 text-[1.125rem] font-semibold ${
          tone === "negative" ? "text-[var(--color-negative)]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
