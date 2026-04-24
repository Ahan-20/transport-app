import Link from "next/link";
import { getRoutes } from "@/lib/queries";
import { EditPill } from "@/components/edit-pill";

export const dynamic = "force-dynamic";

export default function RoutesPage() {
  const routes = getRoutes();

  return (
    <div className="space-y-8 fade-in">
      <section className="panel px-7 py-7">
        <div className="label">Routes</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          All routes{" "}
          <span className="serif text-[2.5rem] text-[var(--color-accent)]">
            · {routes.length}
          </span>
        </h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-2)]">
          Each route belongs to a driver and may be assigned a vehicle.
        </p>
      </section>

      <section className="panel overflow-x-auto">
        <table className="grid">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Code</th>
              <th>Name</th>
              <th>Driver</th>
              <th>Vehicle</th>
              <th className="num">Students</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r, i) => (
              <tr key={r.id}>
                <td className="num text-[var(--color-muted-2)]">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="font-medium text-[var(--color-ink)]">{r.code}</td>
                <td className="text-[var(--color-ink-2)]">{r.name}</td>
                <td>
                  <Link
                    href={`/drivers/${r.driver_id}/edit`}
                    className="text-[var(--color-ink-2)] hover:text-[var(--color-accent)]"
                  >
                    {r.driver_name}
                  </Link>
                </td>
                <td className="text-[var(--color-ink-2)]">
                  {r.vehicle_plate ?? (
                    <span className="text-[var(--color-muted-2)]">—</span>
                  )}
                </td>
                <td className="num text-[var(--color-ink-2)]">
                  {r.active_students}
                </td>
                <td>
                  <EditPill href={`/routes/${r.id}/edit`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
