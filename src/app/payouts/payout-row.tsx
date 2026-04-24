"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { DriverPayoutRow } from "@/lib/queries";
import { formatINR, type MonthCode } from "@/lib/fiscal";

export function PayoutRow({
  rank,
  fy,
  month,
  row,
}: {
  rank: number;
  fy: number;
  month: MonthCode;
  row: DriverPayoutRow;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    row.paid_amount ? String(row.paid_amount) : row.net_due ? row.net_due.toFixed(0) : "",
  );
  const [paidOn, setPaidOn] = useState(
    row.paid_on ?? new Date().toISOString().slice(0, 10),
  );
  const [mode, setMode] = useState(row.mode ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const balance = row.net_due - Number(amount || 0);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/driver-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: row.driver_id,
          fiscal_year: fy,
          month_code: month,
          amount: Number(amount || 0),
          paid_on: paidOn,
          mode: mode.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
      setTimeout(() => setSaved(false), 1200);
    }
  }

  return (
    <tr>
      <td className="num text-[var(--color-muted-2)]">
        {String(rank).padStart(2, "0")}
      </td>
      <td className="font-medium text-[var(--color-ink)]">
        {row.driver_name}
        {row.route_count > 1 ? (
          <span className="ml-2 text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            {row.route_count} routes
          </span>
        ) : null}
      </td>
      <td className="num text-[var(--color-ink-2)]">{row.active_students}</td>
      <td className="num text-[var(--color-muted)]">{formatINR(row.expected)}</td>
      <td className="num text-[var(--color-ink-2)]">{formatINR(row.collected)}</td>
      <td className="num text-[var(--color-muted)]">{formatINR(row.commission_amt)}</td>
      <td className="num font-semibold text-[var(--color-ink)]">
        {formatINR(row.net_due)}
      </td>
      <td className="num">
        <input
          className="input-tight num w-24 text-right"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0"
        />
        {balance !== 0 && amount !== "" ? (
          <div
            className={`mt-0.5 text-[0.65rem] uppercase tracking-[0.08em] ${
              balance > 0 ? "text-[var(--color-negative)]" : "text-[var(--color-muted)]"
            }`}
          >
            {balance > 0 ? `${formatINR(balance)} short` : `${formatINR(-balance)} over`}
          </div>
        ) : null}
      </td>
      <td>
        <input
          type="date"
          className="input-tight"
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
        />
      </td>
      <td>
        <select
          className="input-tight"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="">—</option>
          <option value="CASH">Cash</option>
          <option value="CHEQUE">Cheque</option>
          <option value="BANK">Bank</option>
          <option value="UPI">UPI</option>
        </select>
      </td>
      <td>
        <input
          className="input-tight w-32"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="—"
        />
      </td>
      <td>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[0.75rem] font-medium uppercase tracking-[0.08em] transition-colors ${
            saved
              ? "border-[var(--color-positive)] text-[var(--color-positive)]"
              : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink)]"
          }`}
        >
          <Check size={11} /> {saved ? "Saved" : busy ? "…" : "Save"}
        </button>
      </td>
    </tr>
  );
}
