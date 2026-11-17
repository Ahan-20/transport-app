"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, RotateCcw } from "lucide-react";

export function SuspendControls({
  id,
  name,
  active,
  activeStudents,
}: {
  id: number;
  name: string;
  active: boolean;
  activeStudents: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function setActive(next: boolean) {
    const prompt = next
      ? `Reactivate ${name}?`
      : `Suspend ${name}? They'll be hidden when assigning new students or routes.` +
        (activeStudents > 0
          ? ` Their ${activeStudents} active student${activeStudents === 1 ? "" : "s"} stay assigned until you move them.`
          : "") +
        " All payments and payouts are kept.";
    if (!confirm(prompt)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/drivers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Save failed");
        return;
      }
      if (data.queued) {
        setMessage("Queued for admin approval");
        return;
      }
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
          {active
            ? "Suspending hides this driver from new assignments. Nothing is deleted — payments, payouts and history stay."
            : "This driver is suspended. Reactivate to assign new students and routes again."}
        </p>
        {message ? (
          <div className="mt-2 text-[0.8125rem] text-[var(--color-negative)]">{message}</div>
        ) : null}
      </div>
      {active ? (
        <button
          type="button"
          onClick={() => setActive(false)}
          disabled={busy}
          className="btn btn-ghost text-[var(--color-negative)] hover:border-[var(--color-negative)]"
        >
          <PauseCircle size={13} /> Suspend driver
        </button>
      ) : (
        <button type="button" onClick={() => setActive(true)} disabled={busy} className="btn btn-accent">
          <RotateCcw size={13} /> Reactivate
        </button>
      )}
    </section>
  );
}
