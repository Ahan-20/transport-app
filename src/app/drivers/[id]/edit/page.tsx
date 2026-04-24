import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getDriver,
  getRoutesForDriver,
  getStudentsForDriver,
} from "@/lib/queries";
import { formatINR } from "@/lib/fiscal";
import { EditPill } from "@/components/edit-pill";
import { DriverForm } from "./driver-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditDriverPage({ params }: { params: Params }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const driver = getDriver(id);
  if (!driver) notFound();

  const routes = getRoutesForDriver(id);
  const students = getStudentsForDriver(id);
  const totalMonthly = students.reduce((a, s) => a + s.monthly_fee, 0);

  return (
    <div className="space-y-8 fade-in">
      <div>
        <Link
          href="/drivers"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft size={12} /> All drivers
        </Link>
      </div>

      <section className="panel px-7 py-7">
        <div className="label">Operator</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          {driver.name}{" "}
          <span className="serif text-[2.5rem] text-[var(--color-accent)]">
            · edit
          </span>
        </h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-2)]">
          {routes.length} route{routes.length !== 1 ? "s" : ""} · {students.length}{" "}
          active student{students.length !== 1 ? "s" : ""} · {formatINR(totalMonthly)}{" "}
          monthly
        </p>
      </section>

      <DriverForm
        initial={{
          id: driver.id,
          name: driver.name,
          contact: driver.contact,
          commission_percent: driver.commission_percent,
          sub_driver: driver.sub_driver,
          active: !!driver.active,
        }}
      />

      <section className="panel overflow-x-auto">
        <div className="flex items-center justify-between px-7 pt-6">
          <div>
            <div className="label">Routes</div>
            <h2 className="mt-1 text-[1.5rem] font-medium tracking-[-0.01em] text-[var(--color-ink)]">
              {routes.length} route{routes.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <div className="text-[0.8125rem] text-[var(--color-muted)]">
            Open a route to change the vehicle or deactivate.
          </div>
        </div>
        {routes.length ? (
          <table className="grid mt-4">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Code</th>
                <th>Name</th>
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
                  <td className="text-[var(--color-ink-2)]">
                    {r.vehicle_plate ?? (
                      <span className="text-[var(--color-muted-2)]">—</span>
                    )}
                  </td>
                  <td className="num text-[var(--color-ink-2)]">{r.student_count}</td>
                  <td>
                    <EditPill href={`/routes/${r.id}/edit`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-7 py-10 text-center text-[0.875rem] text-[var(--color-muted)]">
            No routes assigned to this driver yet.
          </div>
        )}
      </section>

      <section className="panel overflow-x-auto">
        <div className="flex items-center justify-between px-7 pt-6">
          <div>
            <div className="label">Roster</div>
            <h2 className="mt-1 text-[1.5rem] font-medium tracking-[-0.01em] text-[var(--color-ink)]">
              {students.length} active student{students.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <div className="text-[0.8125rem] text-[var(--color-muted)]">
            Open a student to reassign driver or route.
          </div>
        </div>
        {students.length ? (
          <table className="grid mt-4">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Name</th>
                <th>School</th>
                <th>Class</th>
                <th>Route</th>
                <th className="num">Monthly fee</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id}>
                  <td className="num text-[var(--color-muted-2)]">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="font-medium text-[var(--color-ink)]">
                    <Link
                      href={`/students/${s.id}`}
                      className="hover:text-[var(--color-accent)]"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="text-[var(--color-ink-2)]">{s.school}</td>
                  <td className="text-[var(--color-ink-2)]">{s.class ?? "—"}</td>
                  <td className="text-[var(--color-ink-2)]">
                    {s.route_code && s.route_id ? (
                      <Link
                        href={`/routes/${s.route_id}/edit`}
                        className="hover:text-[var(--color-accent)]"
                      >
                        {s.route_code}
                      </Link>
                    ) : (
                      <span className="text-[var(--color-muted-2)]">—</span>
                    )}
                  </td>
                  <td className="num text-[var(--color-ink-2)]">
                    {formatINR(s.monthly_fee)}
                  </td>
                  <td>
                    <EditPill href={`/students/${s.id}/edit`} label="Reassign" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-7 py-10 text-center text-[0.875rem] text-[var(--color-muted)]">
            No active students under this driver.
          </div>
        )}
      </section>
    </div>
  );
}
