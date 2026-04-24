import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDrivers, getRoutes, getSchools, getStudent } from "@/lib/queries";
import { StudentForm } from "../../student-form";
import { ArchiveControls } from "./archive-controls";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditStudentPage({ params }: { params: Params }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const student = getStudent(id);
  if (!student) notFound();

  const schools = getSchools();
  const drivers = getDrivers();
  const routes = getRoutes();

  const initial = {
    id,
    name: student.name,
    name_hindi: student.name_hindi,
    class: student.class,
    school_id: student.school_id,
    driver_id: student.driver_id,
    route_id: student.route_id,
    pickup_address: student.pickup_address,
    monthly_fee: student.monthly_fee,
    contact: student.contact,
    sno: student.sno,
    status: student.status,
  };

  return (
    <div className="space-y-8 fade-in">
      <div>
        <Link
          href={`/students/${id}`}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft size={12} /> Back to student
        </Link>
      </div>

      <section className="panel px-7 py-7">
        <div className="label">
          Edit · {initial.status === "ACTIVE" ? "Active" : initial.status}
        </div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          {initial.name}
          {initial.name_hindi ? (
            <span className="ml-3 text-[1.25rem] font-normal text-[var(--color-muted)]">
              {initial.name_hindi}
            </span>
          ) : null}
        </h1>
      </section>

      <StudentForm
        mode="edit"
        initial={initial}
        schools={schools.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
        drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
        routes={routes.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          driver_id: r.driver_id,
        }))}
      />

      <ArchiveControls id={id} status={initial.status} />
    </div>
  );
}
