"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Save } from "lucide-react";
import { MONTH_LABEL, formatINR, type MonthCode } from "@/lib/fiscal";

type Cell = {
  month: MonthCode;
  index: number;
  amount: number | null;
  paid_on: string | null;
  mode: string | null;
  is_current: boolean;
  is_future: boolean;
};

export function MonthlyGrid({
  studentId,
  fy,
  fee,
  months,
}: {
  studentId: number;
  fy: number;
  fee: number;
  months: Cell[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<MonthCode, { value: string; dirty: boolean }>>(() =>
    Object.fromEntries(
      months.map((m) => [
        m.month,
        { value: m.amount != null ? String(m.amount) : "", dirty: false },
      ]),
    ) as Record<MonthCode, { value: string; dirty: boolean }>,
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queuedMsg, setQueuedMsg] = useState<string | null>(null);
  // Synchronous guard against rapid double-clicks. useState updates are async
  // and a fast double-click can fire two saves before disabled propagates.
  const inFlight = useRef(false);

  const dirtyCount = useMemo(
    () => Object.values(drafts).filter((d) => d.dirty).length,
    [drafts],
  );

  const set = useCallback(
    (month: MonthCode, value: string) => {
      setDrafts((prev) => {
        const originalStr =
          months.find((m) => m.month === month)?.amount != null
            ? String(months.find((m) => m.month === month)!.amount)
            : "";
        return { ...prev, [month]: { value, dirty: value !== originalStr } };
      });
    },
    [months],
  );

  const save = useCallback(async () => {
    const entries: {
      studentId: number;
      fy: number;
      month: MonthCode;
      amount: number | null;
      mode: string | null;
    }[] = [];
    for (const m of months) {
      const d = drafts[m.month];
      if (!d?.dirty) continue;
      const num = d.value === "" ? null : parseFloat(d.value);
      if (d.value !== "" && !Number.isFinite(num)) continue;
      entries.push({ studentId, fy, month: m.month, amount: num, mode: null });
    }
    if (!entries.length) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Save failed");
        return;
      }
      const data = await res.json().catch(() => ({}));
      const queued = Number(data.queued ?? 0);
      setQueuedMsg(queued > 0 ? `${queued} change(s) sent for admin approval` : null);
      setSavedAt(Date.now());
      setDrafts((prev) => {
        const next = { ...prev };
        for (const e of entries) next[e.month] = { ...next[e.month], dirty: false };
        return next;
      });
      router.refresh();
    } catch {
      setError("Network error — check your connection");
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }, [months, drafts, studentId, fy, router]);

  return (
    <div className="card overflow-hidden">
      {/* Phones can't fit 12 columns side-by-side at a usable size — drop to
          a 3-column grid on phone and 6 on small tablets, full 12 on desktop. */}
      {/* 11 fee months (no JUN). lg uses arbitrary 11-track grid so the
          last cell isn't an empty trailing column. */}
      <div className="grid grid-cols-3 divide-x divide-[var(--color-rule-soft)] border-b border-[var(--color-rule)] sm:grid-cols-6 lg:[grid-template-columns:repeat(11,minmax(0,1fr))]">
        {months.map((m) => {
          const d = drafts[m.month];
          const v = d?.value ?? "";
          const amt = parseFloat(v);
          const isPaid = Number.isFinite(amt) && amt > 0;
          const isFull = isPaid && amt >= fee;
          const dirty = d?.dirty;
          return (
            <div
              key={m.month}
              className={`relative px-3 py-4 transition-colors ${
                m.is_current ? "bg-[var(--color-accent-soft)]/40" : ""
              } ${dirty ? "bg-[var(--color-warn-soft)]/60" : ""}`}
            >
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
                {isFull ? <Check size={10} className="text-[var(--color-success)]" /> : null}
              </div>
              <input
                className="pay-cell mt-2 text-base"
                data-paid={isPaid}
                data-overdue={!isPaid && !m.is_future}
                value={v}
                inputMode="decimal"
                placeholder="—"
                onChange={(e) => set(m.month, e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    set(m.month, String(fee));
                  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
                    e.preventDefault();
                    save();
                  }
                }}
              />
              {m.paid_on ? (
                <div className="mt-1 text-[0.62rem] text-[var(--color-muted)]">
                  {m.paid_on.slice(5)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between bg-[var(--color-paper)] px-5 py-3 text-xs">
        <div className="flex items-center gap-5 text-[var(--color-muted)]">
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" /> Overdue
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]" /> Paid
          </span>
          <span className="hidden sm:inline">
            <span className="kbd">S</span> to pay full fee · <span className="kbd">⌘S</span> to save
          </span>
        </div>
        <div className="flex items-center gap-3">
          {error ? (
            <span className="text-[var(--color-negative)]">{error}</span>
          ) : queuedMsg ? (
            <span className="text-[var(--color-warn)]">{queuedMsg}</span>
          ) : savedAt && !dirtyCount ? (
            <span className="text-[var(--color-success)]">Saved</span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={!dirtyCount || saving}
            className="btn btn-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={12} />
            {saving ? "Saving…" : dirtyCount ? `Save ${dirtyCount}` : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}
