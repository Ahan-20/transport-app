"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { MonthCode } from "@/lib/fiscal";

type Mode = "CASH" | "UPI" | "BANK" | "CHEQUE";

export function AddInstallmentForm({
  studentId,
  fy,
  month,
  monthlyFee,
  remaining,
}: {
  studentId: number;
  fy: number;
  month: MonthCode;
  monthlyFee: number;
  remaining: number;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : "");
  const [paidOn, setPaidOn] = useState(today);
  const [mode, setMode] = useState<Mode | "">("CASH");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;

    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setMessage("Amount must be a positive number");
      return;
    }
    if (!paidOn) {
      setMessage("Paid-on date is required");
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            {
              studentId,
              fy,
              month,
              amount: num,
              paidOn,
              mode: mode || null,
              notes: notes.trim() || null,
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Save failed");
        return;
      }
      const saved = Number(data.saved ?? 0);
      if (saved > 0) {
        setMessage(`Recorded ₹${num.toLocaleString("en-IN")} installment`);
        // Reset for the next entry
        setAmount("");
        setNotes("");
        router.refresh();
      } else {
        setMessage("Nothing was saved");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <form
      onSubmit={submit}
      className="card mt-4 grid gap-3 px-5 py-4 md:grid-cols-[1fr_1fr_1fr_2fr_auto]"
    >
      <label className="flex flex-col gap-1">
        <span className="label">Amount (₹)</span>
        <input
          className="input-tight"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          autoFocus
        />
        {remaining > 0 ? (
          <button
            type="button"
            onClick={() => setAmount(String(remaining))}
            className="self-start text-[0.7rem] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
          >
            ₹{remaining.toLocaleString("en-IN")} remaining
          </button>
        ) : (
          <span className="text-[0.7rem] text-[var(--color-muted-2)]">
            Fee: ₹{monthlyFee.toLocaleString("en-IN")}
          </span>
        )}
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
          placeholder="Optional"
        />
      </label>
      <div className="flex flex-col items-stretch gap-1">
        <span className="label invisible">_</span>
        <button type="submit" className="btn btn-accent" disabled={busy}>
          <Plus size={13} /> {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {message ? (
        <div
          className={`md:col-span-5 text-[0.8125rem] ${
            message.toLowerCase().includes("error") ||
            message.toLowerCase().includes("required") ||
            message.toLowerCase().includes("must")
              ? "text-[var(--color-negative)]"
              : "text-[var(--color-success)]"
          }`}
        >
          {message}
        </div>
      ) : null}
    </form>
  );
}
