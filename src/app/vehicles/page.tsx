import Link from "next/link";
import { getVehicles } from "@/lib/queries";
import { EditPill } from "@/components/edit-pill";

export const dynamic = "force-dynamic";

export default function VehiclesPage() {
  const vehicles = getVehicles();
  const assigned = vehicles.filter((v) => v.route_count > 0).length;

  return (
    <div className="space-y-8 fade-in">
      <section className="panel px-4 py-5 sm:px-7 sm:py-7">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-8">
          <div>
            <div className="label">Fleet</div>
            <h1 className="mt-3 text-[1.75rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)] sm:text-[2.5rem]">
              All vehicles{" "}
              <span className="serif text-[1.75rem] text-[var(--color-accent)] sm:text-[2.5rem]">
                · {vehicles.length}
              </span>
            </h1>
            <p className="mt-3 text-[0.875rem] text-[var(--color-ink-2)] sm:text-[0.9375rem]">
              {assigned} of {vehicles.length} assigned to a route. Each vehicle has a
              registration plate; capacity and type are optional.
            </p>
          </div>
          <Link href="/vehicles/new" className="btn btn-accent">
            + New vehicle
          </Link>
        </div>
      </section>

      <section className="panel overflow-x-auto">
        <table className="grid">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Plate</th>
              <th>Type</th>
              <th className="num">Capacity</th>
              <th className="num">Routes</th>
              <th>Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[var(--color-muted)]">
                  No vehicles yet. Click <span className="font-semibold">+ New vehicle</span> to add the first one.
                </td>
              </tr>
            ) : (
              vehicles.map((v, i) => (
                <tr key={v.id}>
                  <td className="num text-[var(--color-muted-2)]">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="font-medium text-[var(--color-ink)]">{v.plate}</td>
                  <td className="text-[var(--color-ink-2)]">
                    {v.type ?? <span className="text-[var(--color-muted-2)]">—</span>}
                  </td>
                  <td className="num text-[var(--color-ink-2)]">
                    {v.capacity ?? <span className="text-[var(--color-muted-2)]">—</span>}
                  </td>
                  <td className="num text-[var(--color-ink-2)]">{v.route_count}</td>
                  <td>
                    {v.active ? (
                      <span className="chip chip-positive">Active</span>
                    ) : (
                      <span className="chip">Retired</span>
                    )}
                  </td>
                  <td>
                    <EditPill href={`/vehicles/${v.id}/edit`} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
