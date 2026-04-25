import {
  getCollectionByMonth,
  getDriverMonthBreakdown,
  getDriverRouteMonthBreakdown,
  getDriverSummaryBySchool,
  getPendingStudents,
  getSummary,
  type DriverMonthRow,
  type DriverSchoolSummaryRow,
} from "@/lib/queries";
import {
  MONTHS,
  MONTH_LABEL,
  academicLabel,
  currentFiscalMonthIndex,
  currentFiscalYear,
  formatINR,
  formatINRCompact,
} from "@/lib/fiscal";
import Link from "next/link";
import { CollectionTrend } from "@/components/collection-trend";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const fy = currentFiscalYear();
  const mIdx = currentFiscalMonthIndex();
  const month = MONTHS[mIdx];

  const summary = getSummary(fy, month);
  const trend = getCollectionByMonth(fy);
  const drivers = getDriverMonthBreakdown(fy, month);
  const schoolSummary = getDriverSummaryBySchool(fy);
  const pending = getPendingStudents(fy, month, 6);

  const multiRouteDriver = drivers.find((d) => d.route_count > 1);
  const routeBreakdown = multiRouteDriver
    ? getDriverRouteMonthBreakdown(fy, month, multiRouteDriver.id)
    : [];

  const swsDrivers = schoolSummary.filter((r) => r.school === "SWS");
  const saDrivers = schoolSummary.filter((r) => r.school === "SA");

  const collectedPct =
    summary.total_expected > 0 ? (summary.collected / summary.total_expected) * 100 : 0;

  const ytdExpected = trend.slice(0, mIdx + 1).reduce((a, r) => a + r.expected, 0);
  const ytdActual = trend.reduce((a, r) => a + r.actual, 0);
  const ytdCommission = trend.reduce((a, r) => a + r.commission_amt, 0);
  const ytdNetPay = trend.reduce((a, r) => a + r.net_driver_pay, 0);

  return (
    <div className="space-y-6 fade-in">
      <section className="panel px-4 py-5 sm:px-5">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-6">
          <div>
            <div className="label">BLOCK · OVERVIEW // {academicLabel(fy)}</div>
            <h1 className="mt-2 font-mono text-[1.5rem] font-semibold leading-[1] tracking-[-0.01em] text-[var(--color-ink)] sm:text-[1.9rem]">
              MONTH&nbsp;/&nbsp;<span className="text-[var(--color-accent)]">{MONTH_LABEL[month].toUpperCase()}</span>
            </h1>
            <p className="mt-3 max-w-lg text-[0.8125rem] leading-relaxed text-[var(--color-ink-2)]">
              Collection at <span className="num font-semibold text-[var(--color-ink)]">{collectedPct.toFixed(1)}%</span> of
              expected <span className="num">{formatINR(summary.total_expected)}</span>.
              YTD <span className="num font-semibold text-[var(--color-ink)]">
                {ytdExpected > 0 ? ((ytdActual / ytdExpected) * 100).toFixed(1) : "0.0"}%
              </span>.
            </p>
          </div>
          <div className="grid w-full grid-cols-3 items-stretch gap-0 sm:flex sm:w-auto">
            <PillStat label="EXPECTED" value={formatINRCompact(summary.total_expected)} />
            <PillStat label="COLLECTED" value={formatINRCompact(summary.collected)} emphasis />
            <PillStat label="PENDING" value={formatINRCompact(summary.pending)} tone="negative" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          index="M.01"
          label="ACTIVE ROSTER"
          value={summary.total_count.toLocaleString("en-IN")}
          sub={`SWS ${summary.sws_count} · SA ${summary.sa_count}`}
        />
        <Metric
          index="M.02"
          label={`PAID · ${MONTH_LABEL[month].toUpperCase()}`}
          value={`${summary.paid_count}/${summary.total_count}`}
          sub={`${collectedPct.toFixed(1)}% of month target`}
          accent
        />
        <Metric
          index="M.03"
          label={`PENDING · ${MONTH_LABEL[month].toUpperCase()}`}
          value={formatINRCompact(summary.pending)}
          sub={`${summary.total_count - summary.paid_count} students open`}
          tone="negative"
        />
        <Metric
          index="M.04"
          label="YTD · NET DRIVER PAY"
          value={formatINRCompact(ytdNetPay)}
          sub={`after ${formatINRCompact(ytdCommission)} commission`}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.45fr_1fr]">
        <div className="panel p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="label">CHART · COLLECTION_TREND</div>
              <h2 className="mt-1 mono text-[0.9375rem] font-semibold uppercase tracking-[0.04em] text-[var(--color-ink)]">
                APR → MAR // {fy}–{fy + 1}
              </h2>
            </div>
            <div className="text-right">
              <div className="label">YTD·RATIO</div>
              <div className="num mt-0.5 text-xl font-semibold">
                {ytdExpected > 0 ? `${((ytdActual / ytdExpected) * 100).toFixed(0)}%` : "—"}
              </div>
            </div>
          </div>
          <div className="mt-5 h-[260px]">
            <CollectionTrend
              data={trend.map((r) => ({
                month: MONTH_LABEL[r.month],
                expected: Math.round(r.expected),
                actual: Math.round(r.actual),
                sws: Math.round(r.sws_actual),
                sa: Math.round(r.sa_actual),
              }))}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--color-rule)] pt-3">
            <LegendSwatch color="#0a0a0a" dashed label="EXPECTED" />
            <LegendSwatch color="#1f43ff" label="COLLECTED" />
            <LegendSwatch color="#087f3a" label="SWS" />
            <LegendSwatch color="#b25b00" label="SA" />
          </div>
        </div>

        <div className="panel p-5">
          <div className="label">ACTIONS · SHORTCUTS</div>
          <h2 className="mt-1 mono text-[0.9375rem] font-semibold uppercase tracking-[0.04em]">
            FAST PATHS
          </h2>
          <div className="mt-4 space-y-2">
            <Shortcut
              href="/payments"
              index="A.01"
              title="ENTER PAYMENTS"
              desc="ONE DRIVER · ONE MONTH · KEYBOARD-FIRST"
            />
            <Shortcut
              href="/students"
              index="A.02"
              title="FIND STUDENT"
              desc="NAME · हिन्दी · CONTACT"
            />
            <Shortcut
              href="/pending"
              index="A.03"
              title="CHASE PENDING"
              desc="CURRENT MONTH UNPAID · BY OVERDUE"
            />
            <Shortcut
              href="/health"
              index="A.04"
              title="SYSTEM HEALTH"
              desc="ROWS · TOTALS · SANITY"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <SchoolPanel code="SWS" label="SANCTUM WORLD SCHOOL" rows={swsDrivers} fy={fy} />
        <SchoolPanel code="SA" label="SANCTUM ACADEMY" rows={saDrivers} fy={fy} />
      </section>

      <section className="panel overflow-x-auto">
        <div className="flex items-end justify-between border-b border-[var(--color-rule)] px-5 py-4">
          <div>
            <div className="label">TABLE · DRIVERS // {MONTH_LABEL[month].toUpperCase()}</div>
            <h2 className="mt-1 mono text-[0.9375rem] font-semibold uppercase tracking-[0.04em]">
              COLLECTION BY DRIVER
            </h2>
          </div>
          <Link href="/payments" className="btn btn-ghost">
            ENTER →
          </Link>
        </div>
        <table className="grid">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Driver</th>
              <th className="num">Roster</th>
              <th className="num">Expected</th>
              <th className="num">Collected</th>
              <th className="num">Commission</th>
              <th className="num">Net Pay</th>
              <th className="num">Shortfall</th>
              <th className="num">%</th>
              <th style={{ width: "120px" }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => <DriverRow key={d.id} d={d} i={i} />)}
          </tbody>
        </table>
      </section>

      {multiRouteDriver && routeBreakdown.length > 0 ? (
        <section className="panel overflow-x-auto">
          <div className="flex items-end justify-between border-b border-[var(--color-rule)] px-5 py-4">
            <div>
              <div className="label">DRILL · {multiRouteDriver.name} // {MONTH_LABEL[month].toUpperCase()}</div>
              <h2 className="mt-1 mono text-[0.9375rem] font-semibold uppercase tracking-[0.04em]">
                SUB-ROUTES · {routeBreakdown.length}
              </h2>
            </div>
            <Link href={`/payments/${multiRouteDriver.id}`} className="btn btn-ghost">
              ENTER →
            </Link>
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>Route</th>
                <th className="num">Roster</th>
                <th className="num">Expected</th>
                <th className="num">Collected</th>
                <th className="num">Commission</th>
                <th className="num">Net Pay</th>
                <th className="num">Shortfall</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {routeBreakdown.map((r, i) => {
                const pct = r.expected > 0 ? (r.collected / r.expected) * 100 : 0;
                return (
                  <tr key={r.route_id}>
                    <td className="num text-[var(--color-muted-2)]">{String(i + 1).padStart(2, "0")}</td>
                    <td>
                      <div className="font-medium text-[var(--color-ink)]">{r.route_name}</div>
                      <div className="mono mt-0.5 text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                        {r.route_code}
                      </div>
                    </td>
                    <td className="num">{r.active_students}</td>
                    <td className="num text-[var(--color-muted)]">{formatINR(r.expected)}</td>
                    <td className="num font-semibold text-[var(--color-ink)]">{formatINR(r.collected)}</td>
                    <td className="num text-[var(--color-muted)]">{formatINR(r.commission_amt)}</td>
                    <td className="num text-[var(--color-ink)]">{formatINR(r.net_pay)}</td>
                    <td className="num text-[var(--color-negative)]">{formatINR(r.shortfall)}</td>
                    <td className="num">
                      <PctChip pct={pct} />
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--color-surface-2)]">
                <td></td>
                <td className="mono uppercase tracking-[0.08em] text-[var(--color-ink)]">COMBINED</td>
                <td className="num font-semibold">
                  {routeBreakdown.reduce((a, r) => a + r.active_students, 0)}
                </td>
                <td className="num font-semibold">
                  {formatINR(routeBreakdown.reduce((a, r) => a + r.expected, 0))}
                </td>
                <td className="num font-semibold">
                  {formatINR(routeBreakdown.reduce((a, r) => a + r.collected, 0))}
                </td>
                <td className="num">
                  {formatINR(routeBreakdown.reduce((a, r) => a + r.commission_amt, 0))}
                </td>
                <td className="num font-semibold">
                  {formatINR(routeBreakdown.reduce((a, r) => a + r.net_pay, 0))}
                </td>
                <td className="num text-[var(--color-negative)]">
                  {formatINR(routeBreakdown.reduce((a, r) => a + r.shortfall, 0))}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="panel overflow-x-auto">
        <div className="flex items-end justify-between border-b border-[var(--color-rule)] px-5 py-4">
          <div>
            <div className="label">TABLE · FOLLOW-UP QUEUE</div>
            <h2 className="mt-1 mono text-[0.9375rem] font-semibold uppercase tracking-[0.04em]">
              TOP OVERDUE · {MONTH_LABEL[month].toUpperCase()}
            </h2>
          </div>
          <Link href="/pending" className="btn btn-ghost">
            ALL →
          </Link>
        </div>
        <table className="grid">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Student</th>
              <th>School</th>
              <th>Class</th>
              <th>Driver</th>
              <th className="num">Fee</th>
              <th className="num">Outstanding</th>
              <th className="num">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((s, i) => (
              <tr key={s.id}>
                <td className="num text-[var(--color-muted-2)]">{String(i + 1).padStart(2, "0")}</td>
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
                </td>
                <td>
                  <span className="chip">{s.school}</span>
                </td>
                <td className="text-[var(--color-ink-2)]">{s.class ?? "—"}</td>
                <td className="text-[var(--color-ink-2)]">{s.driver}</td>
                <td className="num text-[var(--color-muted)]">{formatINR(s.monthly_fee)}</td>
                <td className="num font-semibold text-[var(--color-negative)]">
                  {formatINR(s.outstanding_ytd)}
                </td>
                <td className="num">
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
          </tbody>
        </table>
      </section>
    </div>
  );
}

function DriverRow({ d, i }: { d: DriverMonthRow; i: number }) {
  const pct = d.expected > 0 ? (d.collected / d.expected) * 100 : 0;
  return (
    <tr>
      <td className="num text-[var(--color-muted-2)]">{String(i + 1).padStart(2, "0")}</td>
      <td>
        <div className="font-medium text-[var(--color-ink)]">
          {d.name}
          {d.route_count > 1 ? (
            <span className="mono ml-2 text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-accent)]">
              · {d.route_count} ROUTES
            </span>
          ) : null}
        </div>
        <div className="mono mt-0.5 text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-muted)]">
          {d.commission_percent}% COMMISSION
        </div>
      </td>
      <td className="num">{d.active_students}</td>
      <td className="num text-[var(--color-muted)]">{formatINR(d.expected)}</td>
      <td className="num font-semibold text-[var(--color-ink)]">{formatINR(d.collected)}</td>
      <td className="num text-[var(--color-muted)]">{formatINR(d.commission_amt)}</td>
      <td className="num text-[var(--color-ink)]">{formatINR(d.net_pay)}</td>
      <td className="num text-[var(--color-negative)]">
        {d.shortfall > 0 ? formatINR(d.shortfall) : "—"}
      </td>
      <td className="num">
        <PctChip pct={pct} />
      </td>
      <td>
        <div className="progress-track">
          <div
            className={`progress-fill ${pct >= 95 ? "positive" : "accent"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </td>
    </tr>
  );
}

function PctChip({ pct }: { pct: number }) {
  return (
    <span
      className={`mono font-semibold ${
        pct >= 95
          ? "text-[var(--color-positive)]"
          : pct >= 50
            ? "text-[var(--color-ink)]"
            : "text-[var(--color-negative)]"
      }`}
    >
      {pct.toFixed(0)}%
    </span>
  );
}

function SchoolPanel({
  code,
  label,
  rows,
  fy,
}: {
  code: string;
  label: string;
  rows: DriverSchoolSummaryRow[];
  fy: number;
}) {
  const totalStudents = rows.reduce((a, r) => a + r.students, 0);
  const totalMonthly = rows.reduce((a, r) => a + r.monthly_expected, 0);
  const totalYearly = rows.reduce((a, r) => a + r.yearly_expected, 0);
  const totalCollected = rows.reduce((a, r) => a + r.collected_ytd, 0);
  const totalOutstanding = rows.reduce((a, r) => a + r.outstanding, 0);
  const pct = totalYearly > 0 ? (totalCollected / totalYearly) * 100 : 0;

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-end justify-between border-b border-[var(--color-rule)] px-5 py-4">
        <div>
          <div className="label">
            BLOCK · {code} // YTD {fy}–{(fy + 1) % 100}
          </div>
          <h2 className="mt-1 mono text-[0.9375rem] font-semibold uppercase tracking-[0.04em]">
            {label}
          </h2>
        </div>
        <div className="text-right">
          <div className="label">YTD·PCT</div>
          <div className="num mt-0.5 text-xl font-semibold">{pct.toFixed(0)}%</div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-[var(--color-rule)] border-b border-[var(--color-rule)]">
        <StatBox label="STUDENTS" value={totalStudents.toLocaleString("en-IN")} />
        <StatBox label="MONTHLY DUE" value={formatINRCompact(totalMonthly)} />
        <StatBox label="OUTSTANDING" value={formatINRCompact(totalOutstanding)} tone="negative" />
      </div>
      <table className="grid">
        <thead>
          <tr>
            <th>Driver</th>
            <th className="num">Students</th>
            <th className="num">Monthly</th>
            <th className="num">Collected</th>
            <th className="num">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.school}-${r.driver_id}`}>
              <td className="font-medium text-[var(--color-ink)]">{r.driver_name}</td>
              <td className="num">{r.students}</td>
              <td className="num text-[var(--color-muted)]">{formatINR(r.monthly_expected)}</td>
              <td className="num text-[var(--color-ink)]">{formatINR(r.collected_ytd)}</td>
              <td className="num">
                <PctChip pct={r.collection_pct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "negative";
}) {
  return (
    <div className="px-4 py-3">
      <div className="label">{label}</div>
      <div
        className={`num mt-1 text-[1.125rem] font-semibold ${
          tone === "negative" ? "text-[var(--color-negative)]" : "text-[var(--color-ink)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-[2px] w-6"
        style={{
          background: dashed
            ? `repeating-linear-gradient(to right, ${color}, ${color} 3px, transparent 3px, transparent 6px)`
            : color,
        }}
      />
      <span className="mono text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-muted)]">
        {label}
      </span>
    </div>
  );
}

function PillStat({
  label,
  value,
  emphasis = false,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "negative";
}) {
  return (
    <div
      className={`flex flex-col items-end justify-center border-l border-[var(--color-rule)] px-4 ${
        emphasis ? "bg-[var(--color-ink)] text-[var(--color-bg)]" : ""
      }`}
    >
      <div
        className={`mono text-[0.625rem] uppercase tracking-[0.08em] ${
          emphasis ? "text-[var(--color-bg)]/70" : tone === "negative" ? "text-[var(--color-negative)]" : "text-[var(--color-muted)]"
        }`}
      >
        {label}
      </div>
      <div
        className={`num mt-1 text-[1.125rem] font-semibold ${
          tone === "negative" && !emphasis ? "text-[var(--color-negative)]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Metric({
  index,
  label,
  value,
  sub,
  accent = false,
  tone,
}: {
  index: string;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  tone?: "negative";
}) {
  return (
    <div
      className={`panel p-4 ${accent ? "panel-dark" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`mono text-[0.625rem] uppercase tracking-[0.08em] ${
            accent ? "text-[var(--color-bg)]/60" : "text-[var(--color-muted-2)]"
          }`}
        >
          {index}
        </span>
        <span
          className={`mono text-[0.625rem] uppercase tracking-[0.08em] ${
            accent ? "text-[var(--color-accent-soft)]" : tone === "negative" ? "text-[var(--color-negative)]" : "text-[var(--color-muted)]"
          }`}
        >
          {label}
        </span>
      </div>
      <div
        className={`num mt-3 text-[1.75rem] font-semibold leading-none tracking-[-0.01em] ${
          accent ? "text-[var(--color-bg)]" : tone === "negative" ? "text-[var(--color-negative)]" : "text-[var(--color-ink)]"
        }`}
      >
        {value}
      </div>
      {sub ? (
        <div
          className={`mt-2 text-[0.75rem] ${
            accent ? "text-[var(--color-bg)]/60" : "text-[var(--color-muted)]"
          }`}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Shortcut({
  href,
  index,
  title,
  desc,
}: {
  href: string;
  index: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 border border-[var(--color-rule)] px-3 py-2.5 transition-colors hover:border-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
    >
      <span className="mono text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-muted-2)] group-hover:text-[var(--color-accent)]">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <div className="mono text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[var(--color-ink)]">
          {title}
        </div>
        <div className="mono mt-0.5 text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-muted)]">
          {desc}
        </div>
      </div>
      <span className="mono text-[var(--color-muted-2)] group-hover:text-[var(--color-accent)]">→</span>
    </Link>
  );
}
