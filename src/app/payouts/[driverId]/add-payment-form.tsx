"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { MonthCode } from "@/lib/fiscal";

export function AddPaymentForm({
  driverId,
  fy,
  month,
  suggestedAmount,
}: {
  driverId: number;
  fy: number;
  month: MonthCode;
  suggestedAmount: number;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState(
    suggestedAmount > 0 ? suggestedAmount.toFixed(0) : "",
  );
  const [paidOn, setPaidOn] = useState(today);
  const [mode, setMode] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function add() {
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
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/driver-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: driverId,
          fiscal_year: fy,
          month_code: month,
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
      // Reset for next entry. Keep `mode` so repeated cash payments don't
      // require re-selecting it every time.
      setAmount("");
      setNotes("");
      setPaidOn(new Date().toISOString().slice(0, 10));
      setMessage("Payment recorded");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="panel grid gap-3 px-4 py-4 sm:grid-cols-[140px_160px_140px_1fr_auto] sm:items-end sm:px-5">
      <div>
        <label className="label">Amount (₹)</label>
        <input
          className="input-tight num mt-1 text-right"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0"
        />
      </div>
      <div>
        <label className="label">Paid on</label>
        <input
          type="date"
          className="input-tight mt-1"
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Mode</label>
        <select
          className="input-tight mt-1"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="">—</option>
          <option value="CASH">Cash</option>
          <option value="CHEQUE">Cheque</option>
          <option value="BANK">Bank</option>
          <option value="UPI">UPI</option>
        </select>
      </div>
      <div>
        <label className="label">Notes</label>
        <input
          className="input-tight mt-1"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reference, ref no., etc."
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="btn btn-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={13} /> {busy ? "Adding…" : "Add payment"}
        </button>
      </div>
      {(message || error) && (
        <div className="sm:col-span-5">
          {error ? (
            <span className="text-[0.8125rem] text-[var(--color-negative)]">
              {error}
            </span>
          ) : message ? (
            <span className="text-[0.8125rem] text-[var(--color-positive)]">
              {message}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
