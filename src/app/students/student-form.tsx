"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/form-field";

type School = { id: number; code: string; name: string };
type Driver = { id: number; name: string };
type Route = { id: number; code: string; name: string; driver_id: number };

export type StudentInitial = {
  id?: number;
  name: string;
  name_hindi: string | null;
  class: string | null;
  school_id: number;
  driver_id: number;
  route_id: number | null;
  pickup_address: string | null;
  monthly_fee: number;
  contact: string | null;
  sno: number | null;
  status?: "ACTIVE" | "LEFT" | "SUSPENDED";
};

export function StudentForm({
  mode,
  initial,
  schools,
  drivers,
  routes,
}: {
  mode: "create" | "edit";
  initial?: StudentInitial;
  schools: School[];
  drivers: Driver[];
  routes: Route[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [nameHindi, setNameHindi] = useState(initial?.name_hindi ?? "");
  const [klass, setKlass] = useState(initial?.class ?? "");
  const [schoolId, setSchoolId] = useState<number>(
    initial?.school_id ?? schools[0]?.id ?? 0,
  );
  const [driverId, setDriverId] = useState<number>(
    initial?.driver_id ?? drivers[0]?.id ?? 0,
  );
  const [routeId, setRouteId] = useState<number | null>(initial?.route_id ?? null);
  const [pickup, setPickup] = useState(initial?.pickup_address ?? "");
  const [fee, setFee] = useState<string>(
    initial?.monthly_fee != null ? String(initial.monthly_fee) : "",
  );
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [sno, setSno] = useState<string>(
    initial?.sno != null ? String(initial.sno) : "",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  const filteredRoutes = useMemo(
    () => routes.filter((r) => r.driver_id === driverId),
    [routes, driverId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        name: name.trim(),
        name_hindi: nameHindi.trim() || null,
        class: klass.trim() || null,
        school_id: Number(schoolId),
        driver_id: Number(driverId),
        route_id: routeId ?? null,
        pickup_address: pickup.trim() || null,
        monthly_fee: Number(fee),
        contact: contact.trim() || null,
        sno: sno.trim() ? Number(sno) : null,
      };
      if (!payload.name) throw new Error("Name is required");
      if (!payload.school_id) throw new Error("School is required");
      if (!payload.driver_id) throw new Error("Driver is required");
      if (!Number.isFinite(payload.monthly_fee) || payload.monthly_fee < 0)
        throw new Error("Monthly fee must be a non-negative number");

      const url = mode === "create" ? "/api/students" : `/api/students/${initial?.id}`;
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
      // Edits by non-admin users are queued for admin approval — surface that
      // explicitly so the user knows the change isn't applied yet.
      if (data.queued) {
        setMessage("Queued for admin approval");
        return;
      }
      const id = mode === "create" ? data.id : initial?.id;
      router.push(`/students/${id}`);
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
            autoFocus
            required
          />
        </FormField>
        <FormField label="Name (Hindi)">
          <input
            className="input"
            value={nameHindi}
            onChange={(e) => setNameHindi(e.target.value)}
          />
        </FormField>
        <FormField label="Class">
          <input
            className="input"
            value={klass}
            onChange={(e) => setKlass(e.target.value)}
            placeholder="e.g. 5, NUR, PREP"
          />
        </FormField>
        <FormField label="Roll / S.No.">
          <input
            className="input"
            value={sno}
            onChange={(e) => setSno(e.target.value)}
            inputMode="numeric"
          />
        </FormField>
        <FormField label="School" required>
          <select
            className="select"
            value={schoolId}
            onChange={(e) => setSchoolId(Number(e.target.value))}
            required
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Monthly fee (₹)" required>
          <input
            className="input"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            inputMode="decimal"
            required
          />
        </FormField>
      </section>

      <section className="panel grid gap-5 px-7 py-6 md:grid-cols-2">
        <FormField label="Driver" required>
          <select
            className="select"
            value={driverId}
            onChange={(e) => {
              const next = Number(e.target.value);
              setDriverId(next);
              const stillValid = routes.find(
                (r) => r.id === routeId && r.driver_id === next,
              );
              if (!stillValid) setRouteId(null);
            }}
            required
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Route">
          <select
            className="select"
            value={routeId ?? ""}
            onChange={(e) =>
              setRouteId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">—</option>
            {filteredRoutes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} · {r.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Contact">
          <input
            className="input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            inputMode="tel"
          />
        </FormField>
        <FormField label="Pickup address">
          <input
            className="input"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
          />
        </FormField>
      </section>

      <div className="flex items-center justify-between gap-4">
        <div className="text-[0.8125rem] text-[var(--color-muted)]">
          {message ? (
            <span className="text-[var(--color-negative)]">{message}</span>
          ) : (
            "Fields marked with · required."
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
            {busy ? "Saving…" : mode === "create" ? "Add student" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

