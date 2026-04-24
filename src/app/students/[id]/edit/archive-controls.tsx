"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";
import type { StudentStatus } from "@/lib/queries";

export function ArchiveControls({
  id,
  status,
}: {
  id: number;
  status: StudentStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isActive = status === "ACTIVE";

  async function archive(nextStatus: "LEFT" | "SUSPENDED") {
    const label = nextStatus === "LEFT" ? "mark this student as LEFT" : "suspend this student";
    if (!confirm(`Are you sure you want to ${label}? They'll be excluded from active views.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/students/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Archive failed");
        return;
      }
      router.push("/students");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!confirm("Restore this student to ACTIVE?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/students/${id}/restore`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Restore failed");
        return;
      }
      router.push(`/students/${id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel-soft flex flex-wrap items-center justify-between gap-4 rounded-2xl px-6 py-5">
      <div>
        <div className="label">Danger zone</div>
        <p className="mt-1 text-[0.875rem] text-[var(--color-ink-2)]">
          {isActive
            ? "Archive removes the student from active rosters but keeps all history."
            : "This student is currently archived. Restore to make them active again."}
        </p>
        {message ? (
          <div className="mt-2 text-[0.8125rem] text-[var(--color-negative)]">{message}</div>
        ) : null}
      </div>
      <div className="flex gap-2">
        {isActive ? (
          <>
            <button
              type="button"
              onClick={() => archive("SUSPENDED")}
              disabled={busy}
              className="btn btn-ghost"
            >
              <Archive size={13} /> Suspend
            </button>
            <button
              type="button"
              onClick={() => archive("LEFT")}
              disabled={busy}
              className="btn btn-ghost text-[var(--color-negative)] hover:border-[var(--color-negative)]"
            >
              <Archive size={13} /> Mark as left
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={restore}
            disabled={busy}
            className="btn btn-accent"
          >
            <RotateCcw size={13} /> Restore to active
          </button>
        )}
      </div>
    </section>
  );
}
