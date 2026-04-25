import Link from "next/link";
import { getRoutes } from "@/lib/queries";
import { EditPill } from "@/components/edit-pill";

export const dynamic = "force-dynamic";

export default function RoutesPage() {
  const routes = getRoutes();

  return (
    <div className="space-y-8 fade-in">
      <section className="panel px-4 py-5 sm:px-7 sm:py-7">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-8">
          <div>
            <div className="label">Routes</div>
            <h1 className="mt-3 text-[1.75rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)] sm:text-[2.5rem]">
              All routes{" "}
              <span className="serif text-[1.75rem] text-[var(--color-accent)] sm:text-[2.5rem]">
                · {routes.length}
              </span>
            </h1>
            <p className="mt-3 text-[0.875rem] text-[var(--color-ink-2)] sm:text-[0.9375rem]">
              Each route belongs to a driver and may be assigned a vehicle.
              A driver running multiple routes has their payout aggregated
              across all of them.
            </p>
          </div>
          <Link href="/routes/new" className="btn btn-accent">
            + New route
          </Link>
        </div>
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
