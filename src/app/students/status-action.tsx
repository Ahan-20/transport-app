"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Archive } from "lucide-react";

// Archive / Restore button — Compact fits inside a roster table cell.
// Large sits alongside "Edit" on the student detail header. Both prompt
// with the student's name via confirm() to prevent accidental double-taps.
export function StatusAction({
  studentId,
  status,
  name,
  size = "compact",
}: {
  studentId: number;
  status: "ACTIVE" | "LEFT" | "SUSPENDED";
  name: string;
  size?: "compact" | "large";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inFlight = useRef(false);

  const isArchived = status !== "ACTIVE";
  const label = isArchived ? "Restore" : "Archive";
  const url = isArchived
    ? `/api/students/${studentId}/restore`
    : `/api/students/${studentId}/archive`;

  async function act() {
    if (inFlight.current) return;
    const ok = window.confirm(
      isArchived
        ? `Restore ${name} to the active roster?`
        : `Archive ${name}? They'll be marked as LEFT and hidden from the active roster.`,
    );
    if (!ok) return;

    inFlight.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error ?? "Failed");
        return;
      }
      if (data.queued) {
        setMsg("Queued");
        return;
      }
      router.refresh();
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const isLarge = size === "large";
  const sizeClasses = isLarge
    ? "gap-2 px-4 py-2 text-[0.8125rem] tracking-[0.06em]"
    : "gap-1 px-2.5 py-1 text-[0.6875rem] tracking-[0.06em]";
  const iconSize = isLarge ? 14 : 11;

  return (
    <div className={`flex ${isLarge ? "flex-row items-center" : "flex-col items-end"} gap-1`}>
      <button
        type="button"
        onClick={act}
        disabled={busy}
        className={`inline-flex items-center rounded-full border font-medium uppercase transition-colors disabled:opacity-40 ${sizeClasses} ${
          isArchived
            ? "border-[var(--color-positive)]/40 text-[var(--color-positive)] hover:border-[var(--color-positive)] hover:bg-[var(--color-positive)]/10"
            : "border-[var(--color-rule)] text-[var(--color-muted)] hover:border-[var(--color-negative)] hover:text-[var(--color-negative)]"
        }`}
        title={label}
      >
        {isArchived ? <ArchiveRestore size={iconSize} /> : <Archive size={iconSize} />}
        {busy ? "…" : label}
      </button>
      {msg ? (
        <span className="text-[0.625rem] text-[var(--color-muted)]">{msg}</span>
      ) : null}
    </div>
  );
}
