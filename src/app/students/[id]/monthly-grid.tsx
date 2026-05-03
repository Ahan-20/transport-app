"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { MONTH_LABEL, formatINR, isMonthActive, type MonthCode } from "@/lib/fiscal";

type Cell = {
  month: MonthCode;
  index: number;
  amount: number | null;
  paid_on: string | null;
  mode: string | null;
  installment_count: number;
  is_current: boolean;
  is_future: boolean;
};

// Read-only 11-month overview. Each cell is a Link to the per-month
// detail page (`/students/[id]/payments/[month]`) where you can add a
// new installment, edit any existing one, or delete one. Inline editing
// inside this grid is gone now that a cell can hold many installments —
// you can't represent "₹500 + ₹500 + ₹400" in a single text input.
export function MonthlyGrid({
  studentId,
  fy: _fy,
  fee,
  months,
  startMonth,
  endMonth,
}: {
  studentId: number;
  fy: number;
  fee: number;
  months: Cell[];
  startMonth?: MonthCode | null;
  endMonth?: MonthCode | null;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-[var(--color-rule-soft)] border-b border-[var(--color-rule)] sm:grid-cols-6 lg:[grid-template-columns:repeat(11,minmax(0,1fr))]">
        {months.map((m) => {
          const enrolled = isMonthActive(m.month, startMonth, endMonth);
          const total = m.amount ?? 0;
          const isPaid = total > 0;
          const isFull = isPaid && total >= fee;
          const isPartial = isPaid && total < fee;
          const isOverdue = !isPaid && !m.is_future && enrolled;
          const detailHref = `/students/${studentId}/payments/${m.month}`;
          const inner = (
            <>
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-[0.7rem] uppercase tracking-[0.14em] ${
                    m.is_current
                      ? "text-[var(--color-accent)]"
                      : m.is_future
                        ? "text-[var(--color-muted-2)]"
                        : "text-[var(--color-muted)]"
                  }`}
                >
                  {MONTH_LABEL[m.month]}
                </span>
                {isFull ? (
                  <Check size={10} className="text-[var(--color-success)]" />
                ) : null}
              </div>

              {!enrolled ? (
                <div className="mt-2 flex h-9 items-center text-[0.7rem] text-[var(--color-muted-2)]">
                  Not enrolled
                </div>
              ) : (
                <div className="mt-2">
                  <div
                    className={`tabular-nums text-base font-medium ${
                      isFull
                        ? "text-[var(--color-success)]"
                        : isPartial
                          ? "text-[var(--color-warn)]"
                          : isOverdue
                            ? "text-[var(--color-negative)]"
                            : "text-[var(--color-muted-2)]"
                    }`}
                  >
                    {isPaid ? formatINR(total) : "—"}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[0.625rem] text-[var(--color-muted)]">
                    {m.installment_count > 1 ? (
                      <span className="rounded-sm border border-[var(--color-rule)] px-1 py-px tabular-nums">
                        {m.installment_count}×
                      </span>
                    ) : null}
                    {isPartial ? <span>partial</span> : null}
                    {!isPaid && !m.is_future ? <span>overdue</span> : null}
                    {!isPaid && m.is_future ? (
                      <span className="opacity-60">
                        <Plus size={10} className="inline align-text-top" /> add
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </>
          );

          const baseCls = `block px-3 py-4 transition-colors ${
            m.is_current ? "bg-[var(--color-accent-soft)]/40" : ""
          } ${!enrolled ? "bg-[var(--color-rule-soft)] opacity-60" : "hover:bg-[var(--color-surface-2)]"}`;

          return enrolled ? (
            <Link key={m.month} href={detailHref} className={baseCls}>
              {inner}
            </Link>
          ) : (
            <div key={m.month} className={baseCls}>
              {inner}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--color-paper)] px-5 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-[var(--color-muted)]">
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]" />{" "}
            paid full
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-warn)]" />{" "}
            partial
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-negative)]" />{" "}
            overdue
          </span>
        </div>
        <span className="text-[var(--color-muted-2)]">
          Click any month to add an installment, edit, or remove a past payment.
        </span>
      </div>
    </div>
  );
}
