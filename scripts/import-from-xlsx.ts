/**
 * Import from the two per-driver-sheet xlsx files into SQLite.
 *
 *   File A: TRANSPORT 2026-27 SWS.xlsx   → SWS (Sanctum World School)
 *   File B: TRANSPORT 26-27.xlsx         → SA  (Sanctum Academy)
 *
 * Layout: each sheet is one driver's route. Row 1-2 = banner ("DRIVER NAME-phone
 * GADI NO-..."), Row 3 = headers, Row 4+ = student rows. Month columns include
 * APR, MAY, JUL, AUG, SEP, OCT, NOV, DEC, JAN, FEB, MAR (JUN intentionally omitted:
 * summer break). Some sheets add a pre-APR "March" column = last FY dues; we ignore it.
 *
 * Drivers are deduped by phone when present; same name with different phone creates
 * two drivers disambiguated by school suffix.
 *
 * Run: npx tsx scripts/import-from-xlsx.ts
 */

import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

const FILES: { path: string; school: "SWS" | "SA" }[] = [
  { path: "/Users/ahangupta1/Downloads/TRANSPORT 2026-27 SWS.xlsx", school: "SWS" },
  { path: "/Users/ahangupta1/Downloads/TRANSPORT 26-27.xlsx", school: "SA" },
];

const DB_PATH = path.join(process.cwd(), "data", "transport.db");
const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

const FISCAL_YEAR = 2026;

const MONTH_PATTERNS: { code: string; re: RegExp }[] = [
  { code: "APR", re: /^APR/i },
  { code: "MAY", re: /^MAY/i },
  { code: "JUN", re: /^JUN/i },
  { code: "JUL", re: /^JU[LI]/i },
  { code: "AUG", re: /^AUG/i },
  { code: "SEP", re: /^SEP/i },
  { code: "OCT", re: /^OCT/i },
  { code: "NOV", re: /^NOV/i },
  { code: "DEC", re: /^D[EC]/i },
  { code: "JAN", re: /^JAN/i },
  { code: "FEB", re: /^FEB/i },
  { code: "MAR", re: /^MAR/i },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellText(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((r) => r.text).join("").trim() || null;
    }
    if ("text" in obj) return cellText(obj.text as ExcelJS.CellValue);
    if ("result" in obj) return cellText(obj.result as ExcelJS.CellValue);
  }
  return null;
}

function cellNum(v: ExcelJS.CellValue): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[, ₹]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    const r = (v as { result: ExcelJS.CellValue }).result;
    return typeof r === "number" ? r : null;
  }
  return null;
}

function normalizeDriverName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseBanner(banner: string | null): { name: string | null; phone: string | null } {
  if (!banner) return { name: null, phone: null };
  const cleaned = banner.replace(/\s+/g, " ").trim();
  const phoneMatch = cleaned.match(/(\d{10})/);
  const phone = phoneMatch ? phoneMatch[1] : null;
  const before = phoneMatch ? cleaned.slice(0, phoneMatch.index).replace(/[-\s]+$/, "").trim() : cleaned;
  const name = before.replace(/20\d{2}-\d{2}/, "").trim() || null;
  return { name, phone };
}

type ColumnMap = {
  name: number;
  hindi: number;
  classCol: number;
  address: number;
  fee: number;
  contact: number | null;
  months: Record<string, number>; // month_code → col index
};

function mapColumns(headers: (string | null)[]): ColumnMap {
  const lowered = headers.map((h) => (h ? h.toLowerCase() : ""));
  const find = (re: RegExp): number | null => {
    const idx = lowered.findIndex((h) => re.test(h));
    return idx >= 0 ? idx + 1 : null;
  };

  const classCol = find(/class/i) ?? 4;
  const address = find(/addr/i) ?? 5;
  const fee = find(/conv|payment/i) ?? 6;
  const contact = find(/^cont/i);

  const months: Record<string, number> = {};
  let sawApr = false;
  for (let c = 1; c <= headers.length; c++) {
    const h = headers[c - 1];
    if (!h) continue;
    for (const { code, re } of MONTH_PATTERNS) {
      if (re.test(h)) {
        if (code === "MAR" && !sawApr) {
          // Pre-APR "March" = previous-year dues column; skip
          break;
        }
        // First occurrence wins
        if (!(code in months)) months[code] = c;
        if (code === "APR") sawApr = true;
        break;
      }
    }
  }

  return {
    name: 2,
    hindi: 3,
    classCol,
    address,
    fee,
    contact,
    months,
  };
}

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

function openDb(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare("SELECT name FROM _migrations").all().map((r) => (r as { name: string }).name),
  );
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    });
    tx();
    console.log(`[db] applied ${file}`);
  }
  return db;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const db = openDb();

  const schoolByCode: Record<string, number> = {};
  for (const row of db.prepare("SELECT id, code FROM schools").all() as { id: number; code: string }[]) {
    schoolByCode[row.code] = row.id;
  }
  if (!schoolByCode.SWS || !schoolByCode.SA) {
    throw new Error(`Expected SWS + SA rows in schools table; got ${JSON.stringify(schoolByCode)}`);
  }

  const wipe = db.transaction(() => {
    db.exec(`
      DELETE FROM audit_log;
      DELETE FROM monthly_payments;
      DELETE FROM driver_payment_log;
      DELETE FROM students;
      DELETE FROM routes;
      DELETE FROM vehicles;
      DELETE FROM drivers;
    `);
  });
  wipe();
  console.log("[db] wiped operational tables");

  const insDriver = db.prepare(
    `INSERT INTO drivers (name, contact, commission_percent, sub_driver, active)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insRoute = db.prepare(
    `INSERT INTO routes (code, name, driver_id, vehicle_id, active) VALUES (?, ?, ?, ?, ?)`,
  );
  const insStudent = db.prepare(
    `INSERT INTO students
       (sno, school_id, name, name_hindi, class, driver_id, route_id,
        pickup_address, monthly_fee, contact, status, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NULL)`,
  );
  const insPayment = db.prepare(
    `INSERT INTO monthly_payments (student_id, fiscal_year, month_code, amount_paid)
     VALUES (?, ?, ?, ?)`,
  );

  const driverByPhone: Record<string, number> = {};
  const driverByName: Record<string, number> = {};
  const routeCodes = new Set<string>();

  let totalStudents = 0;
  let totalPayments = 0;
  const skipped: string[] = [];

  for (const { path: filePath, school } of FILES) {
    console.log(`\nReading ${filePath} → school=${school}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const schoolId = schoolByCode[school];

    for (const ws of wb.worksheets) {
      const sheetName = ws.name.replace(/\s+/g, " ").trim();
      const banner = cellText(ws.getRow(1).getCell(1).value);
      const { phone } = parseBanner(banner);
      const displayName = normalizeDriverName(sheetName);

      // Resolve driver
      let driverId: number;
      if (phone && driverByPhone[phone]) {
        driverId = driverByPhone[phone];
      } else if (!phone && driverByName[displayName]) {
        driverId = driverByName[displayName];
      } else {
        // Disambiguate if name collides with a previously-created driver
        let finalName = displayName;
        if (driverByName[finalName] && (!phone || !driverByPhone[phone])) {
          finalName = `${displayName} (${school})`;
        }
        const info = insDriver.run(finalName, phone, 10, null, 1);
        driverId = info.lastInsertRowid as number;
        if (phone) driverByPhone[phone] = driverId;
        driverByName[finalName] = driverId;
      }

      // Create route
      const routeCode = `${school}-${normalizeDriverName(sheetName).replace(/\s+/g, "-")}`;
      let uniqueCode = routeCode;
      let n = 2;
      while (routeCodes.has(uniqueCode)) uniqueCode = `${routeCode}-${n++}`;
      routeCodes.add(uniqueCode);
      const routeInfo = insRoute.run(uniqueCode, sheetName, driverId, null, 1);
      const routeId = routeInfo.lastInsertRowid as number;

      // Parse headers from row 3
      const headers: (string | null)[] = [];
      const headerRow = ws.getRow(3);
      for (let c = 1; c <= ws.columnCount; c++) {
        headers.push(cellText(headerRow.getCell(c).value));
      }
      const cols = mapColumns(headers);

      // Import students + payments
      const importSheet = db.transaction(() => {
        for (let r = 4; r <= ws.rowCount; r++) {
          const row = ws.getRow(r);
          const sno = cellNum(row.getCell(1).value);
          if (sno === null || !Number.isFinite(sno) || sno <= 0) continue;
          const name = cellText(row.getCell(cols.name).value);
          if (!name || /^(student\s*name|s\.?\s*no\.?|sr\.?\s*no\.?|total)\b/i.test(name)) continue;

          const nameHindi = cellText(row.getCell(cols.hindi).value);
          const classVal = cellText(row.getCell(cols.classCol).value);
          const address = cellText(row.getCell(cols.address).value);
          const fee = cellNum(row.getCell(cols.fee).value) ?? 0;
          const contact = cols.contact ? cellText(row.getCell(cols.contact).value) : null;

          const info = insStudent.run(
            sno,
            schoolId,
            name,
            nameHindi,
            classVal,
            driverId,
            routeId,
            address,
            fee,
            contact,
          );
          const studentId = info.lastInsertRowid as number;
          totalStudents++;

          for (const [code, c] of Object.entries(cols.months)) {
            const amount = cellNum(row.getCell(c).value);
            if (amount !== null && amount > 0) {
              insPayment.run(studentId, FISCAL_YEAR, code, amount);
              totalPayments++;
            }
          }
        }
      });
      importSheet();

      if (Object.keys(cols.months).length === 0) {
        skipped.push(`${school}:"${sheetName}" — no month columns found`);
      }
    }
  }

  const driverCount = (db.prepare("SELECT COUNT(*) AS c FROM drivers").get() as { c: number }).c;
  const routeCount = (db.prepare("SELECT COUNT(*) AS c FROM routes").get() as { c: number }).c;
  const swsCount = (db
    .prepare("SELECT COUNT(*) AS c FROM students WHERE school_id = ?")
    .get(schoolByCode.SWS) as { c: number }).c;
  const saCount = (db
    .prepare("SELECT COUNT(*) AS c FROM students WHERE school_id = ?")
    .get(schoolByCode.SA) as { c: number }).c;

  console.log("\n--- import summary ---");
  console.log(`drivers: ${driverCount}`);
  console.log(`routes:  ${routeCount}`);
  console.log(`students: ${totalStudents} total  (SWS: ${swsCount}, SA: ${saCount})`);
  console.log(`monthly_payments: ${totalPayments}`);
  if (skipped.length) {
    console.log("\nSkipped / warnings:");
    for (const s of skipped) console.log(`  ${s}`);
  }

  db.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
