"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Save } from "lucide-react";
import type { MonthCode } from "@/lib/fiscal";
import { formatINR, formatINRCompact } from "@/lib/fiscal";

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
  amount: number | null;
  paid_on: string | null;
  mode: string | null;
};

type Draft = { value: string; dirty: boolean; mode: string | null };

export function PaymentEntryTable({
  driverId: _driverId,
  driverName: _driverName,
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
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(
      initial.map((r) => [
        r.id,
        { value: r.amount != null ? String(r.amount) : "", dirty: false, mode: r.mode },
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const dirtyCount = useMemo(
    () => Object.values(drafts).filter((d) => d.dirty).length,
    [drafts],
  );

  const { expected, collected, paidCount } = useMemo(() => {
    let exp = 0;
    let col = 0;
    let cnt = 0;
    for (const r of initial) {
      exp += r.fee;
      const raw = drafts[r.id]?.value ?? "";
      const num = parseFloat(raw);
      if (Number.isFinite(num) && num > 0) {
        col += num;
        cnt += 1;
      }
    }
    return { expected: exp, collected: col, paidCount: cnt };
  }, [initial, drafts]);

  const pct = expected > 0 ? (collected / expected) * 100 : 0;
  const commission = collected * (commissionPercent / 100);

  const setValue = useCallback(
    (id: number, value: string, _fee: number) => {
      setDrafts((prev) => {
        const existing = prev[id];
        const originalStr =
          initial.find((r) => r.id === id)?.amount != null
            ? String(initial.find((r) => r.id === id)!.amount)
            : "";
        const dirty = value !== originalStr;
        const nextMode = value && !existing?.mode ? "CASH" : existing?.mode ?? null;
        return { ...prev, [id]: { value, dirty, mode: nextMode } };
      });
    },
    [initial],
  );

  const save = useCallback(async () => {
    const entries: {
      studentId: number;
      fy: number;
      month: MonthCode;
      amount: number | null;
      mode: string | null;
    }[] = [];
    for (const r of initial) {
      const d = drafts[r.id];
      if (!d?.dirty) continue;
      const num = d.value === "" ? null : parseFloat(d.value);
      if (d.value !== "" && !Number.isFinite(num)) continue;
      entries.push({
        studentId: r.id,
        fy,
        month,
        amount: num,
        mode: d.mode,
      });
    }
    if (!entries.length) return;
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
      setMessage(`${data.saved} SAVED`);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const e of entries) {
          const cur = next[e.studentId];
          if (cur) next[e.studentId] = { ...cur, dirty: false };
        }
        return next;
      });
      router.refresh();
    } catch {
      setMessage("NETWORK ERROR");
    } finally {
      setSaving(false);
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
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCell label="Paid" value={`${paidCount} / ${initial.length}`} />
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

      <section className="panel sticky top-[5.5rem] z-10 flex items-center gap-4 px-5 py-3">
        <div className="flex-1">
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
        <span className="label">{pct.toFixed(0)}% collected</span>
        {message ? (
          <span className="chip chip-positive">✓ {message}</span>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={!dirtyCount || saving}
          className="btn btn-accent disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Save size={13} />
          {saving ? "Saving…" : dirtyCount ? `Save · ${dirtyCount}` : "Save"}
        </button>
      </section>

      <section className="panel overflow-x-auto">
        <table className="grid">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Student</th>
              <th className="w-14">Class</th>
              <th className="w-16">School</th>
              <th className="w-20">Route</th>
              <th className="num w-24">Fee</th>
              <th className="num" style={{ width: 170 }}>
                Paid
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((r, i) => {
              const draft = drafts[r.id];
              const value = draft?.value ?? "";
              const isPaid = parseFloat(value) > 0;
              const isFull = parseFloat(value) >= r.fee;
              const isDirty = !!draft?.dirty;
              return (
                <tr
                  key={r.id}
                  className={isDirty ? "bg-[var(--color-accent-soft)]/40" : ""}
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
                  </td>
                  <td className="text-[var(--color-ink-2)]">{r.class ?? "—"}</td>
                  <td>
                    <span className="chip">{r.school}</span>
                  </td>
                  <td className="mono whitespace-nowrap text-[0.6875rem] uppercase tracking-[0.04em] text-[var(--color-muted)]">
                    {r.route_code ?? "—"}
                  </td>
                  <td className="num whitespace-nowrap text-[var(--color-muted)]">
                    {formatINR(r.fee)}
                  </td>
                  <td className="num">
                    <div className="flex items-center justify-end gap-1.5">
                      <input
                        ref={(el) => {
                          inputs.current[i] = el;
                        }}
                        className="pay-cell"
                        data-paid={isPaid}
                        value={value}
                        inputMode="decimal"
                        onChange={(e) => setValue(r.id, e.target.value, r.fee)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => {
                          if (
                            e.key.toLowerCase() === "s" &&
                            !e.metaKey &&
                            !e.ctrlKey
                          ) {
                            e.preventDefault();
                            setValue(r.id, String(r.fee), r.fee);
                            const nextEl = inputs.current[i + 1];
                            if (nextEl) nextEl.focus();
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            const nextEl = inputs.current[i + 1];
                            if (nextEl) nextEl.focus();
                          }
                        }}
                        placeholder="—"
                      />
                      {isPaid ? (
                        isFull ? (
                          <Check
                            size={12}
                            className="shrink-0 text-[var(--color-positive)]"
                          />
                        ) : (
                          <span className="mono shrink-0 text-[0.625rem] uppercase text-[var(--color-warn)]">
                            PRT
                          </span>
                        )
                      ) : (
                        <span className="w-3 shrink-0" />
                      )}
                    </div>
                  </td>
                  <td>
                    {value ? (
                      <button
                        type="button"
                        onClick={() => setValue(r.id, "", r.fee)}
                        className="rounded p-1 text-[var(--color-muted-2)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-negative)]"
                        title="Clear"
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
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
