"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Save, Printer, ListPlus, Pencil } from "lucide-react";
import type { MonthCode } from "@/lib/fiscal";
import { formatINR, formatINRCompact, isMonthActive, MONTH_LABEL } from "@/lib/fiscal";

type Row = {
  id: number;
  sno: number | null;
  name: string;
  name_hindi: string | null;
  class: string | null;
  school: string;
  route: string | null;
  route_code: string | null;
  fee: number;
  contact: string | null;
  start_month: MonthCode | null;
  end_month: MonthCode | null;
  // Existing total + count of installments. The input is for a NEW installment
  // *on top of* this — every save = one more row in monthly_payments.
  amount: number | null;
  paid_on: string | null;
  mode: string | null;
  installment_count: number;
};

type Draft = { value: string; mode: string | null };

export function PaymentEntryTable({
  driverId: _driverId,
  driverName,
  commissionPercent,
  fy,
  month,
  initial,
}: {
  driverId: number;
  driverName: string;
  commissionPercent: number;
  fy: number;
  month: MonthCode;
  initial: Row[];
}) {
  const router = useRouter();
  // Drafts always start EMPTY. The input is "amount of new installment to
  // record for this student", not "the running total". This is the key
  // semantic change: typing 500 then save adds a ₹500 installment; typing
  // 500 again and saving adds ANOTHER ₹500 (now ₹1000 total in 2 rows).
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(initial.map((r) => [r.id, { value: "", mode: null }])),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const inFlight = useRef(false);

  const dirtyCount = useMemo(
    () =>
      Object.values(drafts).filter((d) => {
        const n = parseFloat(d.value);
        return Number.isFinite(n) && n > 0;
      }).length,
    [drafts],
  );

  // Top-of-page stats. "Collected" reflects what's already saved + what's
  // typed in this session (so as you type, the bar moves). "Paid" counts
  // students who are paid up to or above the monthly fee.
  const { expected, collected, paidCount, enrolledCount } = useMemo(() => {
    let exp = 0;
    let col = 0;
    let cnt = 0;
    let enrolled = 0;
    for (const r of initial) {
      if (!isMonthActive(month, r.start_month, r.end_month)) continue;
      enrolled += 1;
      exp += r.fee;
      const existing = r.amount ?? 0;
      const draftRaw = drafts[r.id]?.value ?? "";
      const draftNum = parseFloat(draftRaw);
      const draftAdd = Number.isFinite(draftNum) && draftNum > 0 ? draftNum : 0;
      const total = existing + draftAdd;
      col += total;
      if (total >= r.fee) cnt += 1;
    }
    return { expected: exp, collected: col, paidCount: cnt, enrolledCount: enrolled };
  }, [initial, drafts, month]);

  const pct = expected > 0 ? (collected / expected) * 100 : 0;
  // Commission is 10% of EXPECTED (the driver is owed their share of what
  // students should pay), not of what's been collected so far.
  const commission = expected * (commissionPercent / 100);

  const setValue = useCallback((id: number, value: string) => {
    setDrafts((prev) => {
      const existing = prev[id];
      const nextMode = value && !existing?.mode ? "CASH" : existing?.mode ?? null;
      return { ...prev, [id]: { value, mode: nextMode } };
    });
  }, []);

  const save = useCallback(async () => {
    const entries: {
      studentId: number;
      fy: number;
      month: MonthCode;
      amount: number;
      mode: string | null;
    }[] = [];
    for (const r of initial) {
      const d = drafts[r.id];
      if (!d?.value) continue;
      const num = parseFloat(d.value);
      if (!Number.isFinite(num) || num <= 0) continue;
      entries.push({
        studentId: r.id,
        fy,
        month,
        amount: num,
        mode: d.mode,
      });
    }
    if (!entries.length) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Save failed");
        return;
      }
      const data = await res.json();
      const saved = Number(data.saved ?? 0);
      setMessage(`${saved} INSTALLMENT${saved === 1 ? "" : "S"} ADDED`);
      // Clear the drafts that successfully saved.
      setDrafts((prev) => {
        const next = { ...prev };
        for (const e of entries) next[e.studentId] = { value: "", mode: null };
        return next;
      });
      router.refresh();
    } catch {
      setMessage("NETWORK ERROR");
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }, [initial, drafts, fy, month, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 1800);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 print:hidden md:grid-cols-4">
        <StatCell label="Paid" value={`${paidCount} / ${enrolledCount}`} />
        <StatCell label="Expected" value={formatINR(expected)} />
        <StatCell
          label="Collected"
          value={formatINR(collected)}
          sub={`${pct.toFixed(0)}% of due`}
          tone={pct >= 95 ? "positive" : "ink"}
        />
        <StatCell
          label="Net pay"
          value={formatINR(collected - commission)}
          sub={`− ${formatINRCompact(commission)} @ ${commissionPercent}%`}
        />
      </section>

      <section className="panel sticky top-[5.5rem] z-10 flex flex-wrap items-center gap-3 px-4 py-3 print:hidden sm:gap-4 sm:px-5">
        <div className="order-1 w-full sm:w-auto sm:flex-1">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, pct)}%`,
                background:
                  pct >= 95 ? "var(--color-positive)" : "var(--color-accent)",
              }}
            />
          </div>
        </div>
        <span className="label order-2">{pct.toFixed(0)}% collected</span>
        {message ? (
          <span className="chip chip-positive order-3">✓ {message}</span>
        ) : null}
        <button
          type="button"
          onClick={() => window.print()}
          className="btn btn-ghost order-4 ml-auto"
          title="Print this list"
        >
          <Printer size={13} />
          Print
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirtyCount || saving}
          className="btn btn-accent order-5 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Save size={13} />
          {saving ? "Saving…" : dirtyCount ? `Save · ${dirtyCount}` : "Save"}
        </button>
      </section>

      <section className="hidden print:block">
        <h1 className="text-2xl font-semibold">
          {driverName} — {MONTH_LABEL[month]} {fy}
        </h1>
        <p className="mt-1 text-sm">
          {paidCount} / {enrolledCount} paid · expected {formatINR(expected)} · collected {formatINR(collected)} · {pct.toFixed(0)}%
        </p>
      </section>

      <section className="panel overflow-x-auto print:overflow-visible print:border-0">
        <table className="grid">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Student</th>
              <th className="w-12 num">Class</th>
              <th className="w-16">School</th>
              <th className="hidden sm:table-cell print:table-cell">Route</th>
              <th className="hidden whitespace-nowrap md:table-cell print:table-cell">Contact</th>
              <th className="num w-24">Fee</th>
              <th className="num w-24">Paid</th>
              <th className="num" style={{ width: 200 }}>
                Add installment
              </th>
            </tr>
          </thead>
          <tbody>
            {initial.map((r, i) => {
              const draft = drafts[r.id];
              const draftValue = draft?.value ?? "";
              const draftNum = parseFloat(draftValue);
              const draftAdd = Number.isFinite(draftNum) && draftNum > 0 ? draftNum : 0;
              const existing = r.amount ?? 0;
              const total = existing + draftAdd;
              const isFull = total >= r.fee;
              const isDirty = draftAdd > 0;
              const enrolled = isMonthActive(month, r.start_month, r.end_month);
              const detailHref = `/students/${r.id}/payments/${month}`;
              return (
                <tr
                  key={r.id}
                  className={`${isDirty ? "bg-[var(--color-accent-soft)]/40" : ""} ${
                    !enrolled ? "opacity-60" : ""
                  }`}
                >
                  <td className="num text-[var(--color-muted-2)]">
                    {String(i + 1).padStart(3, "0")}
                  </td>
                  <td className="whitespace-nowrap">
                    <a
                      href={`/students/${r.id}`}
                      className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                    >
                      {r.name}
                    </a>
                    {r.name_hindi ? (
                      <span className="ml-2 text-[var(--color-muted)]">
                        {r.name_hindi}
                      </span>
                    ) : null}
                    {r.contact ? (
                      <a
                        href={`tel:${r.contact}`}
                        className="mt-0.5 block text-[0.7rem] text-[var(--color-muted)] hover:text-[var(--color-accent)] md:hidden print:hidden"
                      >
                        ☎ {r.contact}
                      </a>
                    ) : null}
                  </td>
                  <td className="num text-[var(--color-ink-2)]">
                    {r.class ?? "—"}
                  </td>
                  <td>
                    <span className="chip">{r.school}</span>
                  </td>
                  <td className="mono hidden whitespace-nowrap text-[0.6875rem] uppercase tracking-[0.04em] text-[var(--color-muted)] sm:table-cell">
                    {r.route_code ?? "—"}
                  </td>
                  <td className="hidden whitespace-nowrap text-[0.8125rem] text-[var(--color-ink-2)] md:table-cell">
                    {r.contact ? (
                      <a
                        href={`tel:${r.contact}`}
                        className="hover:text-[var(--color-accent)]"
                      >
                        {r.contact}
                      </a>
                    ) : (
                      <span className="text-[var(--color-muted-2)]">—</span>
                    )}
                  </td>
                  <td className="num whitespace-nowrap text-[var(--color-muted)]">
                    {enrolled ? formatINR(r.fee) : "—"}
                  </td>
                  {/* Existing paid: total of all installments + small icon to manage them */}
                  <td className="num">
                    <div className="flex items-center justify-end gap-1.5">
                      <span
                        className={`tabular-nums font-medium ${
                          existing >= r.fee
                            ? "text-[var(--color-positive)]"
                            : existing > 0
                              ? "text-[var(--color-warn)]"
                              : "text-[var(--color-muted-2)]"
                        }`}
                      >
                        {existing > 0 ? formatINR(existing) : "—"}
                      </span>
                      {r.installment_count > 0 ? (
                        <Link
                          href={detailHref}
                          title={`${r.installment_count} installment${r.installment_count === 1 ? "" : "s"} · click to manage`}
                          className="rounded p-0.5 text-[var(--color-muted-2)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)] print:hidden"
                        >
                          <Pencil size={11} />
                        </Link>
                      ) : null}
                    </div>
                  </td>
                  {/* New installment input */}
                  <td className="num">
                    {enrolled ? (
                      <div className="flex items-center justify-end gap-1.5 print:hidden">
                        <input
                          ref={(el) => {
                            inputs.current[i] = el;
                          }}
                          className="pay-cell"
                          data-paid={isDirty}
                          value={draftValue}
                          inputMode="decimal"
                          onChange={(e) => setValue(r.id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (
                              e.key.toLowerCase() === "s" &&
                              !e.metaKey &&
                              !e.ctrlKey
                            ) {
                              e.preventDefault();
                              // 'S' fills in the REMAINING fee owed —
                              // closes the gap to a full month payment.
                              const remaining = Math.max(0, r.fee - existing);
                              setValue(r.id, String(remaining || r.fee));
                              const nextEl = inputs.current[i + 1];
                              if (nextEl) nextEl.focus();
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              const nextEl = inputs.current[i + 1];
                              if (nextEl) nextEl.focus();
                            }
                          }}
                          placeholder={existing > 0 ? "+ more" : "—"}
                        />
                        {isDirty && isFull ? (
                          <Check
                            size={12}
                            className="shrink-0 text-[var(--color-positive)]"
                          />
                        ) : isDirty ? (
                          <span className="mono shrink-0 text-[0.625rem] uppercase text-[var(--color-warn)]">
                            +{formatINRCompact(draftAdd)}
                          </span>
                        ) : (
                          <span className="w-3 shrink-0" />
                        )}
                      </div>
                    ) : (
                      <span className="chip text-[var(--color-muted)] print:hidden">
                        Not enrolled
                      </span>
                    )}
                    <span className="hidden print:inline">
                      {existing > 0 ? formatINR(existing) : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="text-center text-[0.75rem] text-[var(--color-muted)] print:hidden">
        Each save records a new installment on top of any existing payments.{" "}
        <Link href="#" onClick={(e) => e.preventDefault()} className="text-[var(--color-muted-2)]">
          {/* placeholder; the per-cell pencil icon already navigates */}
        </Link>
        Click the <Pencil size={11} className="inline align-text-top" /> icon next to a Paid
        amount to view, edit, or delete past installments. Press{" "}
        <span className="kbd">S</span> in an input to auto-fill the remaining fee owed,{" "}
        <span className="kbd">⌘ S</span> to save all.
      </p>
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ink" | "muted" | "positive";
}) {
  const valueColor =
    tone === "muted"
      ? "text-[var(--color-muted)]"
      : tone === "positive"
        ? "text-[var(--color-positive)]"
        : "text-[var(--color-ink)]";
  return (
    <div className="panel flex flex-col justify-center px-5 py-4">
      <div className="label">{label}</div>
      <div
        className={`num mt-2 text-[1.625rem] font-medium leading-none tracking-[-0.02em] ${valueColor}`}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-2 text-[0.75rem] text-[var(--color-muted)]">
          {sub}
        </div>
      ) : null}
    </div>
  );
}
