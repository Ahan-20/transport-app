import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDrivers, getVehicles } from "@/lib/queries";
import { RouteForm } from "../[id]/edit/route-form";

export const dynamic = "force-dynamic";

export default function NewRoutePage() {
  const drivers = getDrivers();
  const vehicles = getVehicles();

  return (
    <div className="space-y-8 fade-in">
      <div>
        <Link
          href="/routes"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft size={12} /> All routes
        </Link>
      </div>

      <section className="panel px-7 py-7">
        <div className="label">New route</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          Add a route{" "}
          <span className="serif text-[2.5rem] text-[var(--color-accent)]">
            · operator + path
          </span>
        </h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-2)]">
          Pick a driver and give the route a short code (e.g. <code>SWS-NARADPURA</code>).
          A driver may operate any number of routes — payouts roll up across all of them.
        </p>
      </section>

      <RouteForm
        mode="create"
        initial={{
          code: "",
          name: "",
          driver_id: drivers[0]?.id ?? 0,
          vehicle_id: null,
          active: true,
        }}
        drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
        vehicles={vehicles.map((v) => ({ id: v.id, plate: v.plate, type: v.type }))}
      />
    </div>
  );
}
