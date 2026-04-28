import { getDb } from "@/lib/db";
import { formatINR } from "@/lib/fiscal";

export const dynamic = "force-dynamic";

type DriverSummary = {
  id: number;
  name: string;
  students: number;
  total_fee: number | null;
  commission_percent: number;
};

type RouteSummary = {
  code: string;
  name: string;
  driver: string;
  students: number;
  plate: string | null;
};

type SampleStudent = {
  sno: number;
  name: string;
  name_hindi: string | null;
  class: string | null;
  school: string;
  driver: string;
  route: string | null;
  monthly_fee: number;
};

function loadData() {
  const db = getDb();
  const counts = {
    schools: (db.prepare("SELECT COUNT(*) AS c FROM schools").get() as { c: number }).c,
    drivers: (db.prepare("SELECT COUNT(*) AS c FROM drivers").get() as { c: number }).c,
    routes: (db.prepare("SELECT COUNT(*) AS c FROM routes").get() as { c: number }).c,
    vehicles: (db.prepare("SELECT COUNT(*) AS c FROM vehicles").get() as { c: number }).c,
    students_total: (db.prepare("SELECT COUNT(*) AS c FROM students").get() as { c: number }).c,
    students_active: (
      db.prepare("SELECT COUNT(*) AS c FROM students WHERE status='ACTIVE'").get() as { c: number }
    ).c,
    students_archived: (
      db.prepare("SELECT COUNT(*) AS c FROM students WHERE status!='ACTIVE'").get() as { c: number }
    ).c,
    monthly_payments: (
      db.prepare("SELECT COUNT(*) AS c FROM monthly_payments").get() as { c: number }
    ).c,
    users: (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c,
  };

  const perSchool = db
    .prepare(
      `SELECT sc.code, sc.name, COUNT(s.id) AS students,
              COALESCE(SUM(s.monthly_fee), 0) AS expected_monthly
         FROM schools sc
         LEFT JOIN students s ON s.school_id = sc.id AND s.status='ACTIVE'
        GROUP BY sc.id
        ORDER BY sc.code`,
    )
    .all() as { code: string; name: string; students: number; expected_monthly: number }[];

  const drivers = db
    .prepare(
      `SELECT d.id, d.name, d.commission_percent,
              COUNT(s.id) AS students,
              SUM(CASE WHEN s.status='ACTIVE' THEN s.monthly_fee ELSE 0 END) AS total_fee
         FROM drivers d
         LEFT JOIN students s ON s.driver_id = d.id
        GROUP BY d.id
        ORDER BY students DESC, d.name`,
    )
    .all() as DriverSummary[];

  const routes = db
    .prepare(
      `SELECT r.code, r.name, d.name AS driver, v.plate,
              COUNT(s.id) AS students
         FROM routes r
         JOIN drivers d ON d.id = r.driver_id
         LEFT JOIN vehicles v ON v.id = r.vehicle_id
         LEFT JOIN students s ON s.route_id = r.id AND s.status='ACTIVE'
        GROUP BY r.id
        ORDER BY d.name, r.code`,
    )
    .all() as RouteSummary[];

  const sample = db
    .prepare(
      `SELECT s.sno, s.name, s.name_hindi, s.class,
              sc.code AS school, d.name AS driver,
              r.name AS route, s.monthly_fee
         FROM students s
         JOIN schools sc ON sc.id = s.school_id
         JOIN drivers d ON d.id = s.driver_id
         LEFT JOIN routes r ON r.id = s.route_id
         WHERE s.status='ACTIVE'
         ORDER BY RANDOM()
         LIMIT 5`,
    )
    .all() as SampleStudent[];

  return { counts, perSchool, drivers, routes, sample };
}

export default function HealthPage() {
  const { counts, perSchool, drivers, routes, sample } = loadData();

  const totalExpected = perSchool.reduce((acc, row) => acc + row.expected_monthly, 0);

  return (
    <div className="space-y-10 fade-in">
      <header>
        <div className="label">Diagnostics</div>
        <h1 className="mt-2 font-display text-4xl font-normal tracking-tight">Database health</h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--color-ink-2)]">
          Sanity check after the initial import. Compare these numbers against the source
          spreadsheets — they should match to the rupee.
        </p>
      </header>

      <section className="card flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="label">Backup</div>
          <h2 className="mt-1 font-display text-xl tracking-tight">Download a snapshot</h2>
          <p className="mt-1 max-w-xl text-[0.8125rem] text-[var(--color-ink-2)]">
            One click downloads the entire database as a single .db file. Save it to
            Google Drive or any safe place. Open with{" "}
            <a
              href="https://sqlitebrowser.org/"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-[var(--color-rule)] decoration-1 underline-offset-[3px] hover:decoration-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              DB Browser for SQLite
            </a>{" "}
            if you ever need to recover. Set up the daily auto-backup to your Mac with
            the script in <code>scripts/backup-to-gdrive.sh</code>.
          </p>
        </div>
        <a href="/api/admin/backup" className="btn btn-accent shrink-0">
          ⬇ Download backup
        </a>
      </section>

      <section>
        <div className="label mb-3">Row counts</div>
        <div className="card grid grid-cols-2 divide-x divide-[var(--color-rule)] sm:grid-cols-3 md:grid-cols-5">
          <Stat label="Schools" value={counts.schools} />
          <Stat label="Drivers" value={counts.drivers} />
          <Stat label="Routes" value={counts.routes} />
          <Stat label="Vehicles" value={counts.vehicles} />
          <Stat label="Users" value={counts.users} />
          <Stat label="Students (total)" value={counts.students_total} />
          <Stat label="Students (active)" value={counts.students_active} accent />
          <Stat label="Students (archived)" value={counts.students_archived} />
          <Stat label="Payment records" value={counts.monthly_payments} />
          <Stat label="Expected / mo" value={totalExpected} isCurrency />
        </div>
      </section>

      <section>
        <div className="label mb-3">By school · active students</div>
        <div className="card overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th className="num">Students</th>
                <th className="num">Expected / mo</th>
              </tr>
            </thead>
            <tbody>
              {perSchool.map((row) => (
                <tr key={row.code}>
                  <td>
                    <span className="inline-flex items-center rounded border border-[var(--color-rule)] px-1.5 py-0.5 text-[0.68rem] font-medium tracking-[0.06em] text-[var(--color-ink-2)]">
                      {row.code}
                    </span>
                  </td>
                  <td>{row.name}</td>
                  <td className="num font-num text-[var(--color-ink-2)]">{row.students}</td>
                  <td className="num font-num">{formatINR(row.expected_monthly)}</td>
                </tr>
              ))}
              <tr className="bg-[var(--color-paper)] font-display">
                <td colSpan={2} className="text-[var(--color-ink)]">
                  Total
                </td>
                <td className="num">{counts.students_active}</td>
                <td className="num tabular">{formatINR(totalExpected)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="label mb-3">Drivers ({drivers.length})</div>
        <div className="card overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Driver</th>
                <th className="num">Commission</th>
                <th className="num">Students</th>
                <th className="num">Expected / mo</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.name}</td>
                  <td className="num font-num text-[var(--color-ink-2)]">{d.commission_percent}%</td>
                  <td className="num font-num text-[var(--color-ink-2)]">{d.students}</td>
                  <td className="num font-num">{formatINR(d.total_fee ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="label mb-3">Routes ({routes.length})</div>
        <div className="card overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Code</th>
                <th>Route</th>
                <th>Driver</th>
                <th>Vehicle</th>
                <th className="num">Students</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.code}>
                  <td>
                    <span className="font-num text-xs text-[var(--color-ink-2)]">{r.code}</span>
                  </td>
                  <td>{r.name}</td>
                  <td className="text-[var(--color-ink-2)]">{r.driver}</td>
                  <td className="font-num text-xs text-[var(--color-muted)]">{r.plate ?? "—"}</td>
                  <td className="num font-num">{r.students}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="label mb-3">5 random students · spot-check</div>
        <div className="card overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Name</th>
                <th>School</th>
                <th>Class</th>
                <th>Driver</th>
                <th>Route</th>
                <th className="num">Fee</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((s, i) => (
                <tr key={i}>
                  <td className="font-num text-[var(--color-muted-2)]">{s.sno}</td>
                  <td>
                    <span className="font-medium">{s.name}</span>
                    {s.name_hindi ? (
                      <span className="ml-2 text-[var(--color-muted)]">{s.name_hindi}</span>
                    ) : null}
                  </td>
                  <td>
                    <span className="inline-flex items-center rounded border border-[var(--color-rule)] px-1.5 py-0.5 text-[0.68rem] font-medium tracking-[0.06em] text-[var(--color-ink-2)]">
                      {s.school}
                    </span>
                  </td>
                  <td className="text-[var(--color-ink-2)]">{s.class ?? "—"}</td>
                  <td className="text-[var(--color-ink-2)]">{s.driver}</td>
                  <td className="text-xs text-[var(--color-muted)]">{s.route ?? "—"}</td>
                  <td className="num font-num">{formatINR(s.monthly_fee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
  isCurrency = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  isCurrency?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="label">{label}</div>
      <div
        className={`mt-2 font-display text-2xl leading-none tracking-tight ${
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-ink)]"
        }`}
      >
        {isCurrency ? formatINR(value) : value.toLocaleString("en-IN")}
      </div>
    </div>
  );
}
