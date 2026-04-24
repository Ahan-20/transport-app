"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/form-field";

type Driver = { id: number; name: string };
type Vehicle = { id: number; plate: string; type: string | null };

export function RouteForm({
  initial,
  drivers,
  vehicles,
}: {
  initial: {
    id: number;
    code: string;
    name: string;
    driver_id: number;
    vehicle_id: number | null;
    active: boolean;
  };
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const [code, setCode] = useState(initial.code);
  const [name, setName] = useState(initial.name);
  const [driverId, setDriverId] = useState(String(initial.driver_id));
  const [vehicleId, setVehicleId] = useState(
    initial.vehicle_id ? String(initial.vehicle_id) : "",
  );
  const [active, setActive] = useState(initial.active);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        driver_id: Number(driverId),
        vehicle_id: vehicleId ? Number(vehicleId) : null,
        active,
      };
      if (!payload.code) throw new Error("Code is required");
      if (!payload.name) throw new Error("Name is required");
      if (!Number.isFinite(payload.driver_id)) throw new Error("Driver is required");

      const res = await fetch(`/api/routes/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Save failed");
        return;
      }
      router.refresh();
      setMessage("Saved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="panel grid gap-5 px-7 py-6 md:grid-cols-2">
        <FormField label="Route code" required>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Route name" required>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Driver" required>
          <select
            className="input"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            required
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Vehicle">
          <select
            className="input"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            <option value="">— Unassigned —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
                {v.type ? ` · ${v.type}` : ""}
              </option>
            ))}
          </select>
        </FormField>
        <label className="flex items-center gap-3 self-end md:col-span-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className="text-[0.875rem] text-[var(--color-ink)]">
            Active — visible in student assignment and dashboards
          </span>
        </label>
      </section>

      <div className="flex items-center justify-between gap-4">
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
              Changing the driver will move this route to a different operator.
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
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

