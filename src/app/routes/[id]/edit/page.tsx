import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getRoute,
  getVehicles,
  getDrivers,
  getStudentsForRoute,
} from "@/lib/queries";
import { formatINR } from "@/lib/fiscal";
import { EditPill } from "@/components/edit-pill";
import { RouteForm } from "./route-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditRoutePage({ params }: { params: Params }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const route = getRoute(id);
  if (!route) notFound();

  const vehicles = getVehicles();
  const drivers = getDrivers();
  const students = getStudentsForRoute(id);
  const totalMonthly = students.reduce((a, s) => a + s.monthly_fee, 0);

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
        <div className="label">Route</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          {route.code}{" "}
          <span className="serif text-[2.5rem] text-[var(--color-accent)]">
            · {route.name}
          </span>
        </h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-2)]">
          Operated by {route.driver_name} · {students.length} active students ·{" "}
          {formatINR(totalMonthly)} monthly
        </p>
      </section>

      <RouteForm
        initial={{
          id: route.id,
          code: route.code,
          name: route.name,
          driver_id: route.driver_id,
          vehicle_id: route.vehicle_id,
          active: !!route.active,
        }}
        drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
        vehicles={vehicles.map((v) => ({ id: v.id, plate: v.plate, type: v.type }))}
      />

      <section className="panel overflow-x-auto">
        <div className="flex items-center justify-between px-7 pt-6">
          <div>
            <div className="label">Roster on this route</div>
            <h2 className="mt-1 text-[1.5rem] font-medium tracking-[-0.01em] text-[var(--color-ink)]">
              {students.length} students
            </h2>
          </div>
          <div className="text-[0.8125rem] text-[var(--color-muted)]">
            Open a student to reassign route or driver.
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
                  <td className="font-medium text-[var(--color-ink)]">{s.name}</td>
                  <td className="text-[var(--color-ink-2)]">{s.school}</td>
                  <td className="text-[var(--color-ink-2)]">{s.class ?? "—"}</td>
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
            No students on this route yet.
          </div>
        )}
      </section>
    </div>
  );
}
