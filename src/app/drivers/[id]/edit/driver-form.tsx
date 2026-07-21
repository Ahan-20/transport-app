"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/form-field";

export type DriverInitial = {
  id?: number;
  name: string;
  contact: string | null;
  commission_percent: number;
  sub_driver: string | null;
  active: boolean;
};

export function DriverForm({
  mode = "edit",
  initial,
}: {
  mode?: "create" | "edit";
  initial: DriverInitial;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [contact, setContact] = useState(initial.contact ?? "");
  const [commission, setCommission] = useState(String(initial.commission_percent));
  const [subDriver, setSubDriver] = useState(initial.sub_driver ?? "");
  const [active, setActive] = useState(initial.active);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        name: name.trim(),
        contact: contact.trim() || null,
        commission_percent: Number(commission),
        sub_driver: subDriver.trim() || null,
        active,
      };
      if (!payload.name) throw new Error("Name is required");
      if (!Number.isFinite(payload.commission_percent))
        throw new Error("Commission must be a number");
      if (payload.commission_percent < 0 || payload.commission_percent > 100)
        throw new Error("Commission must be between 0 and 100");

      const url = mode === "create" ? "/api/drivers" : `/api/drivers/${initial.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Save failed");
        return;
      }
      // Non-admin edits are queued for approval — surface that instead of
      // navigating away as if the change had applied.
      if (data.queued) {
        setMessage("Queued for admin approval");
        return;
      }
      router.push("/drivers");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="panel grid gap-5 px-7 py-6 md:grid-cols-2">
        <FormField label="Name" required>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </FormField>
        <FormField label="Contact">
          <input
            className="input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            inputMode="tel"
          />
        </FormField>
        <FormField label="Commission %" required>
          <input
            className="input"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            inputMode="decimal"
            required
          />
        </FormField>
        <FormField label="Sub-driver (optional)">
          <input
            className="input"
            value={subDriver}
            onChange={(e) => setSubDriver(e.target.value)}
          />
        </FormField>
        <label className="flex items-center gap-3 self-end md:col-span-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className="text-[0.875rem] text-[var(--color-ink)]">
            Active — visible in driver lists and payment entry
          </span>
        </label>
      </section>

      <div className="flex items-center justify-between gap-4">
        <div className="text-[0.8125rem]">
          {message ? (
            <span className="text-[var(--color-negative)]">{message}</span>
          ) : (
            <span className="text-[var(--color-muted)]">
              {mode === "create"
                ? "The driver will show up in payment entry immediately."
                : "Changes apply immediately; historical payments are unaffected."}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-ghost"
            disabled={busy}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {busy ? "Saving…" : mode === "create" ? "Add driver" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
