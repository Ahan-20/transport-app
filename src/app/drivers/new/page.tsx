import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DriverForm } from "../[id]/edit/driver-form";

export const dynamic = "force-dynamic";

export default function NewDriverPage() {
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
        <div className="label">New operator</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          Add a driver{" "}
          <span className="serif text-[2.5rem] text-[var(--color-accent)]">
            · operator
          </span>
        </h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-2)]">
          A driver can operate any number of routes. Commission defaults to 10%
          — set it here or edit it later. Only admins can add or remove drivers.
        </p>
      </section>

      <DriverForm
        mode="create"
        initial={{
          name: "",
          contact: null,
          commission_percent: 10,
          sub_driver: null,
          active: true,
        }}
      />
    </div>
  );
}
