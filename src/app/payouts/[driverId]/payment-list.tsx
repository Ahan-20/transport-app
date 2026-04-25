"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import type { DriverPaymentEntry } from "@/lib/queries";
import { formatINR } from "@/lib/fiscal";

export function PaymentList({ payments }: { payments: DriverPaymentEntry[] }) {
  if (payments.length === 0) {
    return (
      <div className="panel px-5 py-10 text-center text-[var(--color-muted)]">
        <span className="mono text-[0.75rem] uppercase tracking-[0.08em]">
          — NO PAYMENTS RECORDED FOR THIS MONTH —
        </span>
      </div>
    );
  }
  return (
    <div className="panel divide-y divide-[var(--color-rule-soft)] overflow-hidden">
      {payments.map((p) => (
        <PaymentRow key={p.id} payment={p} />
      ))}
    </div>
  );
}

function PaymentRow({ payment }: { payment: DriverPaymentEntry }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [paidOn, setPaidOn] = useState(payment.paid_on);
  const [mode, setMode] = useState(payment.mode ?? "");
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  function reset() {
    setAmount(String(payment.amount));
    setPaidOn(payment.paid_on);
    setMode(payment.mode ?? "");
    setNotes(payment.notes ?? "");
    setError(null);
  }

  async function save() {
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Amount must be greater than zero");
      return;
    }
    if (!paidOn.trim()) {
      setError("Date is required");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/driver-payouts/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          paid_on: paidOn,
          mode: mode.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      if (data.queued) {
        setMessage("Queued for admin approval");
        setEditing(false);
        return;
      }
      setMessage("Saved");
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
      inFlight.current = false;
    }
  }

  async function remove() {
    if (!confirm("Delete this payment? This cannot be undone.")) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/driver-payouts/${payment.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Delete failed");
        return;
      }
      if (data.queued) {
        setMessage("Deletion queued for admin approval");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
      inFlight.current = false;
    }
  }

  if (editing) {
    return (
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[120px_140px_120px_1fr_auto] sm:items-center sm:px-5">
        <input
          className="input-tight num text-right"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          aria-label="Amount"
        />
        <input
          type="date"
          className="input-tight"
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
          aria-label="Date"
        />
        <select
          className="input-tight"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          aria-label="Mode"
        >
          <option value="">—</option>
          <option value="CASH">Cash</option>
          <option value="CHEQUE">Cheque</option>
          <option value="BANK">Bank</option>
          <option value="UPI">UPI</option>
        </select>
        <input
          className="input-tight"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          aria-label="Notes"
        />
        <div className="flex items-center gap-2">
          {error ? (
            <span className="text-[0.75rem] text-[var(--color-negative)]">
              {error}
            </span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={busy === "save"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-positive)] text-[var(--color-positive)] disabled:opacity-50"
            aria-label="Save changes"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setEditing(false);
            }}
            disabled={busy === "save"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-rule)] text-[var(--color-ink-2)] disabled:opacity-50"
            aria-label="Cancel edit"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[120px_140px_120px_1fr_auto] sm:px-5">
      <div className="num font-semibold text-[var(--color-ink)] sm:text-right">
        {formatINR(payment.amount)}
      </div>
      <div className="text-[0.8125rem] text-[var(--color-ink-2)]">
        {payment.paid_on}
      </div>
      <div className="text-[0.75rem] uppercase tracking-[0.08em] text-[var(--color-muted)]">
        {payment.mode ?? "—"}
      </div>
      <div className="col-span-2 text-[0.8125rem] text-[var(--color-muted)] sm:col-span-1">
        {payment.notes ?? (
          <span className="italic text-[var(--color-muted-2)]">no notes</span>
        )}
        {payment.entered_by_name ? (
          <span className="ml-2 text-[var(--color-muted-2)]">
            · entered by {payment.entered_by_name}
          </span>
        ) : null}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
        {message ? (
          <span className="text-[0.7rem] uppercase tracking-[0.08em] text-[var(--color-warn)]">
            {message}
          </span>
        ) : error ? (
          <span className="text-[0.75rem] text-[var(--color-negative)]">
            {error}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={busy !== null}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-50"
          aria-label="Edit payment"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-rule)] text-[var(--color-negative)] hover:border-[var(--color-negative)] disabled:opacity-50"
          aria-label="Delete payment"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
