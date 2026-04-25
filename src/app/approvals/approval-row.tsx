"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

type Row = {
  id: number;
  requested_by: number;
  requested_by_name: string;
  entity: string;
  entity_id: number | null;
  action: string;
  before_json: string | null;
  after_json: string;
  requested_at: string;
};

export function ApprovalRow({ row }: { row: Row }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Guarded parse — corrupt audit rows shouldn't crash the whole approvals page.
  let before: Record<string, unknown> | null = null;
  let after: Record<string, unknown> = {};
  let parseError: string | null = null;
  try {
    if (row.before_json) before = JSON.parse(row.before_json) as Record<string, unknown>;
    after = JSON.parse(row.after_json) as Record<string, unknown>;
  } catch {
    parseError = "Stored change is corrupt — cannot decode JSON.";
  }

  const diffs: { key: string; from: unknown; to: unknown }[] = [];
  for (const k of Object.keys(after)) {
    if (k.startsWith("__")) continue;
    const fromVal = before?.[k];
    const toVal = after[k];
    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      diffs.push({ key: k, from: fromVal, to: toVal });
    }
  }

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    setMessage(null);
    try {
      const res = await fetch(`/api/approvals/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: notes.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel px-7 py-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="label">
            {row.entity} #{row.entity_id} · {row.action}
          </div>
          <div className="mt-1 text-[0.875rem] text-[var(--color-ink)]">
            <span className="font-medium">{row.requested_by_name}</span> requested{" "}
            <span className="text-[var(--color-muted)]">({row.requested_at})</span>
          </div>
          {parseError ? (
            <div className="mt-4 text-[0.8125rem] text-[var(--color-negative)]">
              {parseError}
            </div>
          ) : (
            <dl className="mt-4 grid grid-cols-[auto_1fr_1fr] gap-x-6 gap-y-2 text-[0.8125rem]">
              <div className="label">field</div>
              <div className="label">from</div>
              <div className="label">to</div>
              {diffs.map((d) => (
                <div key={d.key} className="contents">
                  <dt className="font-mono text-[var(--color-ink-2)]">{d.key}</dt>
                  <dd className="text-[var(--color-muted)]">{renderVal(d.from)}</dd>
                  <dd className="font-medium text-[var(--color-ink)]">{renderVal(d.to)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 min-w-[200px]">
          <input
            className="input-tight"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => decide("reject")}
              disabled={!!busy}
              className="btn btn-ghost text-[var(--color-negative)] hover:border-[var(--color-negative)]"
            >
              <X size={13} /> Reject
            </button>
            <button
              type="button"
              onClick={() => decide("approve")}
              disabled={!!busy}
              className="btn btn-accent"
            >
              <Check size={13} /> {busy === "approve" ? "Applying…" : "Approve"}
            </button>
          </div>
          {message ? (
            <div className="text-[0.75rem] text-[var(--color-negative)]">{message}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function renderVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
