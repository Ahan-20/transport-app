"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X } from "lucide-react";
import type { MonthCode } from "@/lib/fiscal";
import { formatINR } from "@/lib/fiscal";
import type { StudentPaymentLogRow } from "@/lib/queries";

type Mode = "CASH" | "UPI" | "BANK" | "CHEQUE";

export function InstallmentList({
  studentId: _studentId,
  fy: _fy,
  month: _month,
  installments,
}: {
  studentId: number;
  fy: number;
  month: MonthCode;
  installments: StudentPaymentLogRow[];
}) {
  if (installments.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-[var(--color-muted)]">
        <span className="mono text-[0.75rem] uppercase tracking-[0.08em]">
          — NO INSTALLMENTS YET —
        </span>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-[var(--color-rule-soft)]">
      {installments.map((r) => (
        <InstallmentRow key={r.id} row={r} />
      ))}
    </ul>
  );
}

function InstallmentRow({ row }: { row: StudentPaymentLogRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const inFlight = useRef(false);

  // Edit-form state
  const [amount, setAmount] = useState(String(row.amount_paid ?? ""));
  const [paidOn, setPaidOn] = useState(row.paid_on ?? "");
  const [mode, setMode] = useState<Mode | "">((row.mode as Mode) ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");

  function reset() {
    setAmount(String(row.amount_paid ?? ""));
    setPaidOn(row.paid_on ?? "");
    setMode((row.mode as Mode) ?? "");
    setNotes(row.notes ?? "");
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (inFlight.current) return;
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    if (!paidOn) {
      setError("Paid-on date is required");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          paid_on: paidOn,
          mode: mode || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      if (data.queued) {
        setOkMsg("Queued for admin approval");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  async function remove() {
    if (!confirm("Delete this installment? The cell total will drop by this amount.")) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${row.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Delete failed");
        return;
      }
      if (data.queued) {
        setOkMsg("Deletion queued for admin approval");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  if (!editing) {
    return (
      <li className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3 hover:bg-[var(--color-surface-3)]">
        <div className="tabular-nums text-[var(--color-muted-2)] w-24">
          {formatPaidOn(row.paid_on)}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <span className="num text-[1rem] font-medium text-[var(--color-ink)]">
              {formatINR(row.amount_paid)}
            </span>
            {row.mode ? (
              <span className="chip">{row.mode}</span>
            ) : null}
            {row.entered_by_name ? (
              <span className="text-[0.7rem] text-[var(--color-muted)]">
                by {row.entered_by_name}
              </span>
            ) : null}
          </div>
          {row.notes ? (
            <div className="mt-0.5 text-[0.8125rem] text-[var(--color-ink-2)]">
              {row.notes}
            </div>
          ) : null}
          {okMsg ? (
            <div className="mt-0.5 text-[0.75rem] text-[var(--color-warn)]">{okMsg}</div>
          ) : null}
          {error ? (
            <div className="mt-0.5 text-[0.75rem] text-[var(--color-negative)]">{error}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="rounded p-1.5 text-[var(--color-muted-2)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
            title="Edit installment"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded p-1.5 text-[var(--color-muted-2)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-negative)]"
            title="Delete installment"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="bg-[var(--color-surface-3)] px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_2fr_auto]">
        <label className="flex flex-col gap-1">
          <span className="label">Amount (₹)</span>
          <input
            className="input-tight"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Paid on</span>
          <input
            type="date"
            className="input-tight"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Mode</span>
          <select
            className="input-tight"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode | "")}
          >
            <option value="">—</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK">Bank</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Notes</span>
          <input
            className="input-tight"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="—"
          />
        </label>
        <div className="flex items-end gap-1">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn btn-accent"
            title="Save changes"
          >
            <Check size={13} /> {busy ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="btn btn-ghost"
            title="Cancel"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      {error ? (
        <div className="mt-2 text-[0.8125rem] text-[var(--color-negative)]">{error}</div>
      ) : null}
    </li>
  );
}

function formatPaidOn(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s + (s.includes("T") ? "" : "T00:00:00"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}
