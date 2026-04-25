import "server-only";
import { getDb } from "./db";
import { MONTHS, type MonthCode } from "./fiscal";

// In-process result cache for read queries. Entries expire after `ttlMs` and
// are flushed wholesale when bumpQueryCache() is called (after a write).
// One Node process serves all requests on Railway, so this is the right scope.
type CacheEntry = { value: unknown; expiresAt: number };
const _cache = new Map<string, CacheEntry>();
let _cacheGen = 0;

export function bumpQueryCache(): void {
  _cacheGen++;
  _cache.clear();
}

function cached<T>(key: string, ttlMs: number, fn: () => T): T {
  const fullKey = `${_cacheGen}:${key}`;
  const now = Date.now();
  const hit = _cache.get(fullKey);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = fn();
  _cache.set(fullKey, { value, expiresAt: now + ttlMs });
  return value;
}

export type PaymentMap = Map<string, { amount: number | null; paid_on: string | null }>;

export type StudentStatus = "ACTIVE" | "LEFT" | "SUSPENDED";
export type StudentStatusFilter = StudentStatus | "ARCHIVED";
export type PaymentFilter = "paid" | "unpaid" | "all";

export function getDrivers() {
  // Driver list rarely changes — cache for 5 min.
  return cached("drivers", 300_000, () =>
    getDb()
      .prepare(
        `SELECT d.id, d.name, d.commission_percent,
                COUNT(CASE WHEN s.status='ACTIVE' THEN 1 END) AS active_students,
                COALESCE(SUM(CASE WHEN s.status='ACTIVE' THEN s.monthly_fee ELSE 0 END), 0) AS expected_monthly
           FROM drivers d
           LEFT JOIN students s ON s.driver_id = d.id
          GROUP BY d.id
          ORDER BY d.name`,
      )
      .all() as {
      id: number;
      name: string;
      commission_percent: number;
      active_students: number;
      expected_monthly: number;
    }[],
  );
}

export function getSchools() {
  // Schools are essentially immutable — cache for 1 hour.
  return cached("schools", 3_600_000, () =>
    getDb()
      .prepare("SELECT id, code, name FROM schools ORDER BY code")
      .all() as { id: number; code: string; name: string }[],
  );
}

export function getRoutes() {
  return getDb()
    .prepare(
      `SELECT r.id, r.code, r.name, r.driver_id, r.vehicle_id, d.name AS driver_name,
              v.plate AS vehicle_plate,
              (SELECT COUNT(*) FROM students s
                 WHERE s.route_id = r.id AND s.status='ACTIVE') AS active_students
         FROM routes r
         JOIN drivers d ON d.id = r.driver_id
         LEFT JOIN vehicles v ON v.id = r.vehicle_id
        ORDER BY d.name, r.code`,
    )
    .all() as {
    id: number;
    code: string;
    name: string;
    driver_id: number;
    vehicle_id: number | null;
    driver_name: string;
    vehicle_plate: string | null;
    active_students: number;
  }[];
}

export function getVehicles() {
  return getDb()
    .prepare(
      `SELECT id, plate, capacity, type, active FROM vehicles ORDER BY plate`,
    )
    .all() as {
    id: number;
    plate: string;
    capacity: number | null;
    type: string | null;
    active: number;
  }[];
}

export function getDriver(id: number) {
  return (
    (getDb()
      .prepare(
        `SELECT id, name, contact, commission_percent, sub_driver, active
           FROM drivers WHERE id = ?`,
      )
      .get(id) as {
      id: number;
      name: string;
      contact: string | null;
      commission_percent: number;
      sub_driver: string | null;
      active: number;
    } | undefined) ?? null
  );
}

export function getRoute(id: number) {
  return (
    (getDb()
      .prepare(
        `SELECT r.id, r.code, r.name, r.driver_id, r.vehicle_id, r.active,
                d.name AS driver_name, v.plate AS vehicle_plate
           FROM routes r
           JOIN drivers d ON d.id = r.driver_id
           LEFT JOIN vehicles v ON v.id = r.vehicle_id
          WHERE r.id = ?`,
      )
      .get(id) as {
      id: number;
      code: string;
      name: string;
      driver_id: number;
      vehicle_id: number | null;
      active: number;
      driver_name: string;
      vehicle_plate: string | null;
    } | undefined) ?? null
  );
}

export function getStudentsForRoute(routeId: number) {
  return getDb()
    .prepare(
      `SELECT s.id, s.name, s.class, s.monthly_fee, sc.code AS school
         FROM students s
         JOIN schools sc ON sc.id = s.school_id
        WHERE s.route_id = ? AND s.status='ACTIVE'
        ORDER BY s.name`,
    )
    .all(routeId) as {
    id: number;
    name: string;
    class: string | null;
    monthly_fee: number;
    school: string;
  }[];
}

export function getRoutesForDriver(driverId: number) {
  return getDb()
    .prepare(
      `SELECT r.id, r.code, r.name, r.vehicle_id, r.active,
              v.plate AS vehicle_plate,
              (SELECT COUNT(*) FROM students s
                 WHERE s.route_id = r.id AND s.status='ACTIVE') AS student_count
         FROM routes r
         LEFT JOIN vehicles v ON v.id = r.vehicle_id
        WHERE r.driver_id = ?
        ORDER BY r.code`,
    )
    .all(driverId) as {
    id: number;
    code: string;
    name: string;
    vehicle_id: number | null;
    active: number;
    vehicle_plate: string | null;
    student_count: number;
  }[];
}

export function getStudentsForDriver(driverId: number) {
  return getDb()
    .prepare(
      `SELECT s.id, s.name, s.class, s.monthly_fee,
              sc.code AS school,
              r.code AS route_code, r.id AS route_id
         FROM students s
         JOIN schools sc ON sc.id = s.school_id
         LEFT JOIN routes r ON r.id = s.route_id
        WHERE s.driver_id = ? AND s.status='ACTIVE'
        ORDER BY sc.code, s.name`,
    )
    .all(driverId) as {
    id: number;
    name: string;
    class: string | null;
    monthly_fee: number;
    school: string;
    route_code: string | null;
    route_id: number | null;
  }[];
}

export type CollectionMonth = {
  month: MonthCode;
  expected: number;
  sws_expected: number;
  sa_expected: number;
  actual: number;
  sws_actual: number;
  sa_actual: number;
  commission_amt: number;
  net_driver_pay: number;
  shortfall: number;
  count_paid: number;
  count_total: number;
};

export function getCollectionByMonth(fy: number): CollectionMonth[] {
  return cached(`collection:${fy}`, 30_000, () => _getCollectionByMonth(fy));
}

function _getCollectionByMonth(fy: number): CollectionMonth[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.month_code AS month,
              COALESCE(SUM(CASE WHEN sc.code='SWS' THEN p.amount_paid ELSE 0 END), 0) AS sws_actual,
              COALESCE(SUM(CASE WHEN sc.code='SA'  THEN p.amount_paid ELSE 0 END), 0) AS sa_actual,
              COALESCE(SUM(p.amount_paid), 0) AS actual,
              COALESCE(SUM(p.amount_paid * d.commission_percent / 100.0), 0) AS commission_amt,
              COUNT(CASE WHEN p.amount_paid > 0 THEN 1 END) AS count_paid
         FROM monthly_payments p
         JOIN students s ON s.id = p.student_id
         JOIN schools sc ON sc.id = s.school_id
         JOIN drivers d ON d.id = s.driver_id
        WHERE p.fiscal_year = ?
        GROUP BY p.month_code`,
    )
    .all(fy) as {
    month: MonthCode;
    sws_actual: number;
    sa_actual: number;
    actual: number;
    commission_amt: number;
    count_paid: number;
  }[];

  const expectedRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN sc.code='SWS' THEN monthly_fee END), 0) AS sws_expected,
         COALESCE(SUM(CASE WHEN sc.code='SA'  THEN monthly_fee END), 0) AS sa_expected,
         COALESCE(SUM(monthly_fee), 0) AS total_expected
         FROM students s JOIN schools sc ON sc.id = s.school_id
        WHERE s.status='ACTIVE'`,
    )
    .get() as { sws_expected: number; sa_expected: number; total_expected: number };

  const totalCount = (
    db.prepare("SELECT COUNT(*) AS c FROM students WHERE status='ACTIVE'").get() as { c: number }
  ).c;

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return MONTHS.map((m) => {
    const r = byMonth.get(m);
    const actual = r?.actual ?? 0;
    const commission_amt = r?.commission_amt ?? 0;
    return {
      month: m,
      expected: expectedRow.total_expected,
      sws_expected: expectedRow.sws_expected,
      sa_expected: expectedRow.sa_expected,
      actual,
      sws_actual: r?.sws_actual ?? 0,
      sa_actual: r?.sa_actual ?? 0,
      commission_amt,
      net_driver_pay: actual - commission_amt,
      shortfall: Math.max(0, expectedRow.total_expected - actual),
      count_paid: r?.count_paid ?? 0,
      count_total: totalCount,
    };
  });
}

export function getSummary(fy: number, month: MonthCode) {
  return cached(`summary:${fy}:${month}`, 15_000, () => _getSummary(fy, month));
}

function _getSummary(fy: number, month: MonthCode) {
  const db = getDb();
  const expectedRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN sc.code='SWS' THEN monthly_fee END), 0) AS sws_expected,
         COALESCE(SUM(CASE WHEN sc.code='SA'  THEN monthly_fee END), 0) AS sa_expected,
         COALESCE(SUM(monthly_fee), 0) AS total_expected,
         COUNT(CASE WHEN sc.code='SWS' THEN 1 END) AS sws_count,
         COUNT(CASE WHEN sc.code='SA' THEN 1 END) AS sa_count,
         COUNT(*) AS total_count
         FROM students s JOIN schools sc ON sc.id = s.school_id
        WHERE s.status='ACTIVE'`,
    )
    .get() as {
    sws_expected: number;
    sa_expected: number;
    total_expected: number;
    sws_count: number;
    sa_count: number;
    total_count: number;
  };

  const actualRow = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount_paid), 0) AS collected,
              COUNT(CASE WHEN p.amount_paid > 0 THEN 1 END) AS paid_count
         FROM monthly_payments p
        WHERE p.fiscal_year = ? AND p.month_code = ?`,
    )
    .get(fy, month) as { collected: number; paid_count: number };

  return {
    ...expectedRow,
    collected: actualRow.collected,
    paid_count: actualRow.paid_count,
    pending: expectedRow.total_expected - actualRow.collected,
  };
}


export type DriverPayoutRow = {
  driver_id: number;
  driver_name: string;
  commission_percent: number;
  route_count: number;
  active_students: number;
  expected: number;
  collected: number;
  commission_amt: number;
  net_due: number;
  shortfall: number;
  log_id: number | null;
  paid_amount: number;
  paid_on: string | null;
  mode: string | null;
  notes: string | null;
};

export function getDriverPayouts(fy: number, month: MonthCode): DriverPayoutRow[] {
  const rows = getDb()
    .prepare(
      // Replace nested IN+subquery-per-driver with a direct LEFT JOIN on payments.
      `SELECT d.id AS driver_id, d.name AS driver_name, d.commission_percent,
              (SELECT COUNT(*) FROM routes r WHERE r.driver_id = d.id) AS route_count,
              COUNT(DISTINCT CASE WHEN s.status='ACTIVE' THEN s.id END)               AS active_students,
              COALESCE(SUM(CASE WHEN s.status='ACTIVE' THEN s.monthly_fee ELSE 0 END), 0) AS expected,
              COALESCE(SUM(CASE WHEN s.status='ACTIVE' THEN p.amount_paid ELSE NULL END), 0) AS collected,
              l.id AS log_id, l.amount AS paid_amount, l.paid_on, l.mode, l.notes
         FROM drivers d
         LEFT JOIN students s ON s.driver_id = d.id
         LEFT JOIN monthly_payments p
                ON p.student_id = s.id AND p.fiscal_year = ? AND p.month_code = ?
         LEFT JOIN driver_payment_log l
                ON l.driver_id = d.id AND l.fiscal_year = ? AND l.month_code = ?
        WHERE d.active = 1
        GROUP BY d.id
        ORDER BY active_students DESC, d.name`,
    )
    .all(fy, month, fy, month) as {
    driver_id: number;
    driver_name: string;
    commission_percent: number;
    route_count: number;
    active_students: number;
    expected: number;
    collected: number;
    log_id: number | null;
    paid_amount: number | null;
    paid_on: string | null;
    mode: string | null;
    notes: string | null;
  }[];

  return rows.map((r) => {
    const commission_amt = (r.collected * r.commission_percent) / 100;
    const net_due = r.collected - commission_amt;
    return {
      ...r,
      commission_amt,
      net_due,
      shortfall: Math.max(0, r.expected - r.collected),
      paid_amount: r.paid_amount ?? 0,
    };
  });
}

export type DriverMonthRow = {
  id: number;
  name: string;
  commission_percent: number;
  route_count: number;
  active_students: number;
  expected: number;
  collected: number;
  commission_amt: number;
  net_pay: number;
  shortfall: number;
};

export function getDriverMonthBreakdown(fy: number, month: MonthCode): DriverMonthRow[] {
  return cached(`driver-month:${fy}:${month}`, 15_000, () =>
    _getDriverMonthBreakdown(fy, month),
  );
}

function _getDriverMonthBreakdown(fy: number, month: MonthCode): DriverMonthRow[] {
  const rows = getDb()
    .prepare(
      // Aggregate payments via LEFT JOIN instead of a nested IN+subquery per driver.
      `SELECT d.id, d.name, d.commission_percent,
              (SELECT COUNT(*) FROM routes r WHERE r.driver_id = d.id) AS route_count,
              COUNT(DISTINCT CASE WHEN s.status='ACTIVE' THEN s.id END)               AS active_students,
              COALESCE(SUM(CASE WHEN s.status='ACTIVE' THEN s.monthly_fee ELSE 0 END), 0) AS expected,
              COALESCE(SUM(CASE WHEN s.status='ACTIVE' THEN p.amount_paid ELSE NULL END), 0) AS collected
         FROM drivers d
         LEFT JOIN students s ON s.driver_id = d.id
         LEFT JOIN monthly_payments p
                ON p.student_id = s.id AND p.fiscal_year = ? AND p.month_code = ?
        GROUP BY d.id
        ORDER BY active_students DESC, d.name`,
    )
    .all(fy, month) as Omit<DriverMonthRow, "commission_amt" | "net_pay" | "shortfall">[];

  return rows.map((r) => {
    const commission_amt = (r.collected * r.commission_percent) / 100;
    return {
      ...r,
      commission_amt,
      net_pay: r.collected - commission_amt,
      shortfall: Math.max(0, r.expected - r.collected),
    };
  });
}

export type DriverRouteMonthRow = {
  driver_id: number;
  driver_name: string;
  commission_percent: number;
  route_id: number;
  route_code: string;
  route_name: string;
  active_students: number;
  expected: number;
  collected: number;
  commission_amt: number;
  net_pay: number;
  shortfall: number;
};

export function getDriverRouteMonthBreakdown(
  fy: number,
  month: MonthCode,
  driverId?: number,
): DriverRouteMonthRow[] {
  const where = driverId ? "WHERE d.id = ?" : "";
  const args: (string | number)[] = [fy, month];
  if (driverId) args.push(driverId);

  const rows = getDb()
    .prepare(
      // Replace nested IN+subquery-per-(driver,route) with a direct LEFT JOIN on payments.
      `SELECT d.id AS driver_id, d.name AS driver_name, d.commission_percent,
              r.id AS route_id, r.code AS route_code, r.name AS route_name,
              COUNT(DISTINCT CASE WHEN s.status='ACTIVE' THEN s.id END)               AS active_students,
              COALESCE(SUM(CASE WHEN s.status='ACTIVE' THEN s.monthly_fee ELSE 0 END), 0) AS expected,
              COALESCE(SUM(CASE WHEN s.status='ACTIVE' THEN p.amount_paid ELSE NULL END), 0) AS collected
         FROM drivers d
         JOIN routes r ON r.driver_id = d.id
         LEFT JOIN students s ON s.driver_id = d.id AND s.route_id = r.id
         LEFT JOIN monthly_payments p
                ON p.student_id = s.id AND p.fiscal_year = ? AND p.month_code = ?
         ${where}
        GROUP BY d.id, r.id
        ORDER BY d.name, r.code`,
    )
    .all(...args) as Omit<DriverRouteMonthRow, "commission_amt" | "net_pay" | "shortfall">[];

  return rows.map((r) => {
    const commission_amt = (r.collected * r.commission_percent) / 100;
    return {
      ...r,
      commission_amt,
      net_pay: r.collected - commission_amt,
      shortfall: Math.max(0, r.expected - r.collected),
    };
  });
}

export type DriverSchoolSummaryRow = {
  school: string;
  driver_id: number;
  driver_name: string;
  commission_percent: number;
  students: number;
  monthly_expected: number;
  yearly_expected: number;
  collected_ytd: number;
  outstanding: number;
  collection_pct: number;
};

export function getDriverSummaryBySchool(fy: number): DriverSchoolSummaryRow[] {
  return cached(`driver-school:${fy}`, 30_000, () =>
    _getDriverSummaryBySchool(fy),
  );
}

function _getDriverSummaryBySchool(fy: number): DriverSchoolSummaryRow[] {
  const rows = getDb()
    .prepare(
      // Aggregate per-student payments in a derived table first, then join once —
      // avoids a correlated subquery that re-scans monthly_payments per (driver, school).
      `SELECT sc.code AS school,
              d.id AS driver_id, d.name AS driver_name, d.commission_percent,
              COUNT(s.id)                        AS students,
              COALESCE(SUM(s.monthly_fee), 0)    AS monthly_expected,
              COALESCE(SUM(pa.paid_sum), 0)      AS collected_ytd
         FROM drivers d
         JOIN students s ON s.driver_id = d.id AND s.status='ACTIVE'
         JOIN schools sc ON sc.id = s.school_id
         LEFT JOIN (
           SELECT student_id, SUM(amount_paid) AS paid_sum
             FROM monthly_payments
            WHERE fiscal_year = ?
            GROUP BY student_id
         ) pa ON pa.student_id = s.id
        GROUP BY sc.code, d.id
        ORDER BY sc.code, d.name`,
    )
    .all(fy) as Omit<
    DriverSchoolSummaryRow,
    "yearly_expected" | "outstanding" | "collection_pct"
  >[];

  return rows.map((r) => {
    const yearly_expected = r.monthly_expected * 12;
    return {
      ...r,
      yearly_expected,
      outstanding: Math.max(0, yearly_expected - r.collected_ytd),
      collection_pct: yearly_expected > 0 ? (r.collected_ytd / yearly_expected) * 100 : 0,
    };
  });
}

export type PendingStudentRow = {
  id: number;
  name: string;
  name_hindi: string | null;
  class: string | null;
  monthly_fee: number;
  school: string;
  driver_id: number;
  driver: string;
  route: string | null;
  route_id: number | null;
  unpaid_months: number;
  outstanding_ytd: number;
};

export function getPendingStudents(fy: number, month: MonthCode, limit = 10000): PendingStudentRow[] {
  const monthIdx = MONTHS.indexOf(month);
  const elapsedMonths = MONTHS.slice(0, monthIdx + 1);
  const elapsedCount = elapsedMonths.length;
  const placeholders = elapsedMonths.map(() => "?").join(",");

  // Use a CTE to aggregate payments once across all students (one pass over
  // monthly_payments) instead of running two correlated subqueries per student.
  return getDb()
    .prepare(
      `WITH paid_agg AS (
         SELECT p.student_id,
                COUNT(CASE WHEN p.amount_paid > 0 THEN 1 END) AS paid_count,
                COALESCE(SUM(p.amount_paid), 0)               AS paid_sum,
                MAX(CASE WHEN p.month_code = ? AND p.amount_paid > 0 THEN 1 ELSE 0 END) AS paid_this_month
           FROM monthly_payments p
          WHERE p.fiscal_year = ? AND p.month_code IN (${placeholders})
          GROUP BY p.student_id
       )
       SELECT s.id, s.name, s.name_hindi, s.class, s.monthly_fee,
              sc.code AS school,
              d.id AS driver_id, d.name AS driver,
              r.name AS route, r.id AS route_id,
              ${elapsedCount} - COALESCE(pa.paid_count, 0)                        AS unpaid_months,
              (s.monthly_fee * ${elapsedCount}) - COALESCE(pa.paid_sum, 0)        AS outstanding_ytd
         FROM students s
         JOIN schools sc ON sc.id = s.school_id
         JOIN drivers d ON d.id = s.driver_id
         LEFT JOIN routes r ON r.id = s.route_id
         LEFT JOIN paid_agg pa ON pa.student_id = s.id
        WHERE s.status = 'ACTIVE'
          AND COALESCE(pa.paid_this_month, 0) = 0
        ORDER BY unpaid_months DESC, outstanding_ytd DESC, s.name
        LIMIT ${limit}`,
    )
    .all(month, fy, ...elapsedMonths) as PendingStudentRow[];
}

export function getDriverRoster(driverId: number) {
  const db = getDb();
  const driver = db
    .prepare("SELECT id, name, commission_percent FROM drivers WHERE id = ?")
    .get(driverId) as { id: number; name: string; commission_percent: number } | undefined;
  if (!driver) return null;
  const students = db
    .prepare(
      `SELECT s.id, s.sno, s.name, s.name_hindi, s.class, s.monthly_fee,
              sc.code AS school, r.code AS route_code, r.name AS route_name
         FROM students s
         JOIN schools sc ON sc.id = s.school_id
         LEFT JOIN routes r ON r.id = s.route_id
        WHERE s.driver_id = ? AND s.status='ACTIVE'
        ORDER BY sc.code, s.name`,
    )
    .all(driverId) as {
    id: number;
    sno: number | null;
    name: string;
    name_hindi: string | null;
    class: string | null;
    monthly_fee: number;
    school: string;
    route_code: string | null;
    route_name: string | null;
  }[];
  return { driver, students };
}

export function getYearlyPaymentsByStudent(fy: number, studentIds: number[]) {
  if (!studentIds.length) return new Map<number, Map<MonthCode, number>>();
  const placeholders = studentIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT student_id, month_code, amount_paid
         FROM monthly_payments
        WHERE fiscal_year = ? AND student_id IN (${placeholders}) AND amount_paid > 0`,
    )
    .all(fy, ...studentIds) as {
    student_id: number;
    month_code: MonthCode;
    amount_paid: number;
  }[];
  const result = new Map<number, Map<MonthCode, number>>();
  for (const r of rows) {
    let map = result.get(r.student_id);
    if (!map) {
      map = new Map();
      result.set(r.student_id, map);
    }
    map.set(r.month_code, r.amount_paid);
  }
  return result;
}

export function getPaymentsForStudents(studentIds: number[], fy: number, month: MonthCode) {
  if (!studentIds.length) return new Map<number, { amount: number | null; paid_on: string | null; mode: string | null }>();
  const placeholders = studentIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT student_id, amount_paid, paid_on, mode
         FROM monthly_payments
        WHERE fiscal_year = ? AND month_code = ? AND student_id IN (${placeholders})`,
    )
    .all(fy, month, ...studentIds) as {
    student_id: number;
    amount_paid: number | null;
    paid_on: string | null;
    mode: string | null;
  }[];
  return new Map(rows.map((r) => [r.student_id, { amount: r.amount_paid, paid_on: r.paid_on, mode: r.mode }]));
}

export type StudentDetail = {
  id: number;
  sno: number | null;
  name: string;
  name_hindi: string | null;
  class: string | null;
  school_id: number;
  driver_id: number;
  route_id: number | null;
  pickup_address: string | null;
  monthly_fee: number;
  contact: string | null;
  status: StudentStatus;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  school_code: string;
  school_name: string;
  driver_name: string;
  commission_percent: number;
  route_code: string | null;
  route_name: string | null;
  vehicle_plate: string | null;
};

export function getStudent(id: number): StudentDetail | null {
  const row = getDb()
    .prepare(
      `SELECT s.*, sc.code AS school_code, sc.name AS school_name,
              d.name AS driver_name, d.commission_percent,
              r.code AS route_code, r.name AS route_name,
              v.plate AS vehicle_plate
         FROM students s
         JOIN schools sc ON sc.id = s.school_id
         JOIN drivers d ON d.id = s.driver_id
         LEFT JOIN routes r ON r.id = s.route_id
         LEFT JOIN vehicles v ON v.id = r.vehicle_id
        WHERE s.id = ?`,
    )
    .get(id) as StudentDetail | undefined;
  return row ?? null;
}

export function getStudentPayments(studentId: number, fy: number) {
  const rows = getDb()
    .prepare(
      `SELECT month_code, amount_paid, paid_on, mode, ref_no, notes
         FROM monthly_payments
        WHERE student_id = ? AND fiscal_year = ?`,
    )
    .all(studentId, fy) as {
    month_code: MonthCode;
    amount_paid: number | null;
    paid_on: string | null;
    mode: string | null;
    ref_no: string | null;
    notes: string | null;
  }[];
  return new Map(rows.map((r) => [r.month_code, r]));
}

export type StudentListRow = {
  id: number;
  sno: number | null;
  name: string;
  name_hindi: string | null;
  class: string | null;
  monthly_fee: number;
  school: string;
  driver: string;
  driver_id: number;
  route: string | null;
  route_id: number | null;
  status: StudentStatus;
  paid_this_month: number;
};

export function listStudents(params: {
  q?: string;
  school?: string;
  driverId?: number;
  status?: StudentStatusFilter;
  payment?: PaymentFilter;
  fy: number;
  month: MonthCode | "ALL";
  limit?: number;
}): StudentListRow[] {
  const { q, school, driverId, status = "ACTIVE", payment = "all", fy, month, limit = 1000 } = params;
  const ytd = month === "ALL";
  const conds: string[] = [];
  const args: (string | number)[] = ytd ? [fy] : [fy, month];
  if (status === "ACTIVE") {
    conds.push("s.status='ACTIVE'");
  } else if (status === "ARCHIVED") {
    conds.push("s.status!='ACTIVE'");
  }
  if (school) {
    conds.push("sc.code = ?");
    args.push(school);
  }
  if (driverId) {
    conds.push("s.driver_id = ?");
    args.push(driverId);
  }
  if (q) {
    conds.push("(s.name LIKE ? OR s.name_hindi LIKE ? OR s.contact LIKE ?)");
    const t = `%${q}%`;
    args.push(t, t, t);
  }
  if (payment === "paid") {
    if (ytd) {
      conds.push(
        "EXISTS (SELECT 1 FROM monthly_payments p WHERE p.student_id = s.id AND p.fiscal_year = ? AND p.amount_paid > 0)",
      );
      args.push(fy);
    } else {
      conds.push(
        "EXISTS (SELECT 1 FROM monthly_payments p WHERE p.student_id = s.id AND p.fiscal_year = ? AND p.month_code = ? AND p.amount_paid > 0)",
      );
      args.push(fy, month as string);
    }
  } else if (payment === "unpaid") {
    if (ytd) {
      conds.push(
        "NOT EXISTS (SELECT 1 FROM monthly_payments p WHERE p.student_id = s.id AND p.fiscal_year = ? AND p.amount_paid > 0)",
      );
      args.push(fy);
    } else {
      conds.push(
        "NOT EXISTS (SELECT 1 FROM monthly_payments p WHERE p.student_id = s.id AND p.fiscal_year = ? AND p.month_code = ? AND p.amount_paid > 0)",
      );
      args.push(fy, month as string);
    }
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const paidExpr = ytd
    ? `COALESCE((SELECT SUM(p.amount_paid) FROM monthly_payments p
                  WHERE p.student_id = s.id AND p.fiscal_year = ?), 0)`
    : `COALESCE((SELECT p.amount_paid FROM monthly_payments p
                  WHERE p.student_id = s.id AND p.fiscal_year = ? AND p.month_code = ?), 0)`;
  return getDb()
    .prepare(
      `SELECT s.id, s.sno, s.name, s.name_hindi, s.class, s.monthly_fee, s.status,
              sc.code AS school, d.name AS driver, d.id AS driver_id,
              r.name AS route, r.id AS route_id,
              ${paidExpr} AS paid_this_month
         FROM students s
         JOIN schools sc ON sc.id = s.school_id
         JOIN drivers d ON d.id = s.driver_id
         LEFT JOIN routes r ON r.id = s.route_id
         ${where}
        ORDER BY s.name
        LIMIT ${limit}`,
    )
    .all(...args) as StudentListRow[];
}
