import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VehicleForm } from "../[id]/edit/vehicle-form";

export const dynamic = "force-dynamic";

export default function NewVehiclePage() {
  return (
    <div className="space-y-8 fade-in">
      <div>
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft size={12} /> All vehicles
        </Link>
      </div>

      <section className="panel px-7 py-7">
        <div className="label">New vehicle</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          Add a vehicle{" "}
          <span className="serif text-[2.5rem] text-[var(--color-accent)]">
            · plate + type
          </span>
        </h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-2)]">
          Once added, this vehicle becomes available in the route edit form.
        </p>
      </section>

      <VehicleForm
        mode="create"
        initial={{
          plate: "",
          capacity: null,
          type: "",
          active: true,
        }}
      />
    </div>
  );
}
