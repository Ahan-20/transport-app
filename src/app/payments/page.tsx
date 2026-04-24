import Link from "next/link";
import { getDriverMonthBreakdown } from "@/lib/queries";
import {
  MONTHS,
  MONTH_LABEL,
  academicLabel,
  currentFiscalMonthIndex,
  currentFiscalYear,
  formatINR,
  formatINRCompact,
} from "@/lib/fiscal";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

export default async function PaymentsIndex({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const fy = currentFiscalYear();
  const month = ((sp.month as (typeof MONTHS)[number]) ??
    MONTHS[currentFiscalMonthIndex()]) as (typeof MONTHS)[number];

  const drivers = getDriverMonthBreakdown(fy, month);
  const totalExpected = drivers.reduce((a, d) => a + d.expected, 0);
  const totalCollected = drivers.reduce((a, d) => a + d.collected, 0);

  return (
    <div className="space-y-8 fade-in">
      <header className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="label">Payment Entry · {academicLabel(fy)}</div>
            <h1 className="mt-2 font-display text-4xl font-normal leading-[1.02] tracking-tight">
              Pick a driver for{" "}
              <em className="italic text-[var(--color-accent)]">{MONTH_LABEL[month]}</em>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-[var(--color-ink-2)]">
              The fastest entry is one driver at a time. Everything is keyboard-first — tab moves
              between students, press <span className="kbd">S</span> to mark a row paid in full.
            </p>
          </div>
          <div className="text-right">
            <div className="label">Collected · {MONTH_LABEL[month]}</div>
            <div className="mt-1 font-display text-2xl tabular">
              {formatINRCompact(totalCollected)}
              <span className="ml-2 text-[var(--color-muted)]">/ {formatINRCompact(totalExpected)}</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-1.5 border-y border-[var(--color-rule)] py-3">
          {MONTHS.map((m, i) => {
            const active = m === month;
            const fyMonth = i <= 8 ? fy : fy + 1;
            return (
              <Link
                key={m}
                href={`/payments?month=${m}`}
                className={`flex items-baseline gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                    : "hover:bg-[var(--color-paper-2)] text-[var(--color-ink-2)]"
                }`}
              >
                <span className="font-display">{MONTH_LABEL[m]}</span>
                <span
                  className={`text-[0.65rem] uppercase tracking-[0.12em] ${
                    active ? "text-[var(--color-paper-2)]" : "text-[var(--color-muted)]"
                  }`}
                >
                  {String(fyMonth).slice(2)}
                </span>
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {drivers.map((d) => {
          const pct = d.expected > 0 ? (d.collected / d.expected) * 100 : 0;
          return (
            <Link
              key={d.id}
              href={`/payments/${d.id}/${month}`}
              className="group relative block card p-5 transition-all hover:border-[var(--color-ink)] hover:shadow-[0_2px_0_rgba(26,23,20,0.04)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-xl tracking-tight text-[var(--color-ink)]">
                    {d.name}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
                    {d.active_students} students · {d.commission_percent}% commission
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className="mt-1 text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-accent)]"
                />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-4 border-t border-[var(--color-rule)] pt-4">
                <div>
                  <div className="label">Expected</div>
                  <div className="mt-1 font-num text-sm">{formatINR(d.expected)}</div>
                </div>
                <div>
                  <div className="label">Collected</div>
                  <div className="mt-1 font-num text-sm text-[var(--color-ink)]">
                    {formatINR(d.collected)}
                  </div>
                </div>
                <div>
                  <div className="label">%</div>
                  <div
                    className={`mt-1 font-display text-lg ${
                      pct >= 95
                        ? "text-[var(--color-success)]"
                        : pct >= 50
                          ? "text-[var(--color-ink)]"
                          : "text-[var(--color-accent)]"
                    }`}
                  >
                    {pct.toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[var(--color-rule-soft)]">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background: pct >= 95 ? "var(--color-success)" : pct >= 50 ? "var(--color-ink)" : "var(--color-accent)",
                  }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
