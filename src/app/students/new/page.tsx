import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDrivers, getRoutes, getSchools } from "@/lib/queries";
import { StudentForm } from "../student-form";

export const dynamic = "force-dynamic";

export default function NewStudentPage() {
  const schools = getSchools();
  const drivers = getDrivers();
  const routes = getRoutes();

  return (
    <div className="space-y-8 fade-in">
      <div>
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft size={12} /> All students
        </Link>
      </div>

      <section className="panel px-7 py-7">
        <div className="label">Admission</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          New{" "}
          <span className="serif text-[2.5rem] text-[var(--color-accent)]">
            student
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-[0.9375rem] text-[var(--color-ink-2)]">
          Adds a student to the active roster. Payments for prior months can be
          entered from the student detail page.
        </p>
      </section>

      <StudentForm
        mode="create"
        schools={schools.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
        drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
        routes={routes.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          driver_id: r.driver_id,
        }))}
      />
    </div>
  );
}
