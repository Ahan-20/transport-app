"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/form-field";

type Driver = { id: number; name: string };
type Vehicle = { id: number; plate: string; type: string | null };

export type RouteFormInitial = {
  id?: number;
  code: string;
  name: string;
  driver_id: number;
  vehicle_id: number | null;
  active: boolean;
};

export function RouteForm({
  mode,
  initial,
  drivers,
  vehicles,
}: {
  mode: "create" | "edit";
  initial: RouteFormInitial;
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const [code, setCode] = useState(initial.code);
  const [name, setName] = useState(initial.name);
  const [driverId, setDriverId] = useState(
    initial.driver_id ? String(initial.driver_id) : drivers[0]?.id ? String(drivers[0].id) : "",
  );
  const [vehicleId, setVehicleId] = useState(
    initial.vehicle_id ? String(initial.vehicle_id) : "",
  );
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
        code: code.trim(),
        name: name.trim(),
        driver_id: Number(driverId),
        vehicle_id: vehicleId ? Number(vehicleId) : null,
        active,
      };
      if (!payload.code) throw new Error("Code is required");
      if (!payload.name) throw new Error("Name is required");
      if (!Number.isFinite(payload.driver_id) || payload.driver_id <= 0) {
        throw new Error("Driver is required");
      }

      const url = mode === "create" ? "/api/routes" : `/api/routes/${initial.id}`;
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
      if (data.queued) {
        setMessage("Queued for admin approval");
        return;
      }
      if (mode === "create") {
        router.push(`/routes/${data.id}/edit`);
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

  async function deleteRoute() {
    if (mode !== "edit" || !initial.id) return;
    if (!confirm("Delete this route? Any students still on it must be reassigned first.")) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/routes/${initial.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Delete failed");
        return;
      }
      if (data.queued) {
        setMessage("Deletion queued for admin approval");
        return;
      }
      router.push("/routes");
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
        <FormField label="Route code" required>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. SWS-NARADPURA"
            required
          />
        </FormField>
        <FormField label="Route name" required>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Naradpura"
            required
          />
        </FormField>
        <FormField label="Driver" required>
          <select
            className="select"
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
            className="select"
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

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-[0.8125rem]">
          {message ? (
            <span
              className={
                message === "Saved"
                  ? "text-[var(--color-positive)]"
                  : message.includes("Queued")
                    ? "text-[var(--color-warn)]"
                    : "text-[var(--color-negative)]"
              }
            >
              {message}
            </span>
          ) : (
            <span className="text-[var(--color-muted)]">
              {mode === "create"
                ? "A driver may have multiple routes — both will roll up under the same payout."
                : "Changing the driver will move this route to a different operator."}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" ? (
            <button
              type="button"
              onClick={deleteRoute}
              className="btn btn-ghost text-[var(--color-negative)] hover:border-[var(--color-negative)]"
              disabled={busy}
            >
              Delete route
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
                ? "Create route"
                : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
