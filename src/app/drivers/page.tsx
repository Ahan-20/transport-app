import { getDrivers } from "@/lib/queries";
import { formatINR } from "@/lib/fiscal";
import { EditPill } from "@/components/edit-pill";

export const dynamic = "force-dynamic";

export default function DriversPage() {
  const drivers = getDrivers();
  const totalStudents = drivers.reduce((a, d) => a + d.active_students, 0);
  const totalExpected = drivers.reduce((a, d) => a + d.expected_monthly, 0);

  return (
    <div className="space-y-8 fade-in">
      <section className="panel px-7 py-7">
        <div className="label">Operators</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          Drivers{" "}
          <span className="serif text-[2.5rem] text-[var(--color-accent)]">
            · {drivers.length}
          </span>
        </h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-2)]">
          Operating {totalStudents} active students ·{" "}
          {formatINR(totalExpected)} expected monthly.
        </p>
      </section>

      <section className="panel overflow-x-auto">
        <table className="grid">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Name</th>
              <th className="num">Commission</th>
              <th className="num">Students</th>
              <th className="num">Expected monthly</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => (
              <tr key={d.id}>
                <td className="num text-[var(--color-muted-2)]">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="font-medium text-[var(--color-ink)]">{d.name}</td>
                <td className="num text-[var(--color-ink-2)]">
                  {d.commission_percent}%
                </td>
                <td className="num text-[var(--color-ink-2)]">
                  {d.active_students}
                </td>
                <td className="num text-[var(--color-ink-2)]">
                  {formatINR(d.expected_monthly)}
                </td>
                <td>
                  <EditPill href={`/drivers/${d.id}/edit`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
