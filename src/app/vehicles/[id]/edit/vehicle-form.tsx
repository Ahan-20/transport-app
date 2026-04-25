"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/form-field";

export type VehicleFormInitial = {
  id?: number;
  plate: string;
  capacity: number | null;
  type: string | null;
  active: boolean;
};

export function VehicleForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial: VehicleFormInitial;
}) {
  const router = useRouter();
  const [plate, setPlate] = useState(initial.plate);
  const [capacity, setCapacity] = useState(
    initial.capacity != null ? String(initial.capacity) : "",
  );
  const [type, setType] = useState(initial.type ?? "");
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
      const trimmed = plate.trim().toUpperCase();
      if (!trimmed) throw new Error("Plate is required");
      const cap = capacity.trim() === "" ? null : Number(capacity);
      if (cap !== null && (!Number.isFinite(cap) || cap <= 0)) {
        throw new Error("Capacity must be a positive number");
      }
      const payload = {
        plate: trimmed,
        capacity: cap,
        type: type.trim() || null,
        active,
      };

      const url = mode === "create" ? "/api/vehicles" : `/api/vehicles/${initial.id}`;
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
      if (mode === "create") {
        router.push("/vehicles");
        router.refresh();
        return;
      }
      router.refresh();
      setMessage("Saved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  async function deleteVehicle() {
    if (mode !== "edit" || !initial.id) return;
    if (!confirm("Delete this vehicle? Any routes using it must be reassigned first.")) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/vehicles/${initial.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Delete failed");
        return;
      }
      router.push("/vehicles");
      router.refresh();
    } catch {
      setMessage("Network error");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="panel grid gap-5 px-7 py-6 md:grid-cols-2">
        <FormField label="Plate (registration)" required>
          <input
            className="input"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="e.g. RJ14-PF-5011"
            autoCapitalize="characters"
            required
          />
        </FormField>
        <FormField label="Type">
          <input
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g. Bus, Van, Tempo Traveller"
          />
        </FormField>
        <FormField label="Capacity (seats)">
          <input
            className="input"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 32"
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
            Active — available for assignment to routes
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-[0.8125rem]">
          {message ? (
            <span
              className={
                message === "Saved"
                  ? "text-[var(--color-positive)]"
                  : "text-[var(--color-negative)]"
              }
            >
              {message}
            </span>
          ) : (
            <span className="text-[var(--color-muted)]">
              Vehicles can be assigned to routes once created.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" ? (
            <button
              type="button"
              onClick={deleteVehicle}
              className="btn btn-ghost text-[var(--color-negative)] hover:border-[var(--color-negative)]"
              disabled={busy}
            >
              Delete vehicle
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-ghost"
            disabled={busy}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {busy
              ? "Saving…"
              : mode === "create"
                ? "Add vehicle"
                : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
