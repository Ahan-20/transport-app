import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getVehicle } from "@/lib/queries";
import { VehicleForm } from "./vehicle-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditVehiclePage({ params }: { params: Params }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const vehicle = getVehicle(id);
  if (!vehicle) notFound();

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
        <div className="label">Vehicle</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          {vehicle.plate}{" "}
          {vehicle.type ? (
            <span className="serif text-[2.5rem] text-[var(--color-accent)]">
              · {vehicle.type}
            </span>
          ) : null}
        </h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-2)]">
          {vehicle.capacity ? `${vehicle.capacity} seats. ` : ""}
          {vehicle.active ? "Active and available for routes." : "Retired — not selectable on new routes."}
        </p>
      </section>

      <VehicleForm
        mode="edit"
        initial={{
          id: vehicle.id,
          plate: vehicle.plate,
          capacity: vehicle.capacity,
          type: vehicle.type,
          active: !!vehicle.active,
        }}
      />
    </div>
  );
}
