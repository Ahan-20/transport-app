import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import path from "node:path";

const FILES: { path: string; school: "SWS" | "SA" }[] = [
  { path: "/Users/ahangupta1/Downloads/TRANSPORT 2026-27 SWS.xlsx", school: "SWS" },
  { path: "/Users/ahangupta1/Downloads/TRANSPORT 26-27.xlsx", school: "SA" },
];

const MONTH_PATTERNS = [
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

function cellText(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
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

function validSno(v: ExcelJS.CellValue): boolean {
  const n = cellNum(v);
  return n !== null && Number.isFinite(n) && n > 0;
}

(async () => {
  const db = new Database(path.join(process.cwd(), "data", "transport.db"));

  const expected: Record<string, { students: number; fees: number; payments: number; monthMap: Record<string, number> }> = {};

  for (const { path: p, school } of FILES) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(p);
    for (const ws of wb.worksheets) {
      const sheetName = ws.name.replace(/\s+/g, " ").trim();
      const key = `${school}:${sheetName}`;

      // parse headers
      const headers: (string | null)[] = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        headers.push(cellText(ws.getRow(3).getCell(c).value));
      }
      const months: Record<string, number> = {};
      let sawApr = false;
      for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        if (!h) continue;
        for (const { code, re } of MONTH_PATTERNS) {
          if (re.test(h)) {
            if (code === "MAR" && !sawApr) break;
            if (!(code in months)) months[code] = c + 1;
            if (code === "APR") sawApr = true;
            break;
          }
        }
      }
      const feeCol = headers.findIndex((h) => h && /conv|payment/i.test(h)) + 1 || 6;

      let students = 0;
      let fees = 0;
      let payments = 0;
      const monthMap: Record<string, number> = {};
      for (let r = 4; r <= ws.rowCount; r++) {
        if (!validSno(ws.getRow(r).getCell(1).value)) continue;
        const name = cellText(ws.getRow(r).getCell(2).value);
        if (!name || /^(student\s*name|total)\b/i.test(name)) continue;
        students++;
        fees += cellNum(ws.getRow(r).getCell(feeCol).value) ?? 0;
        for (const [code, col] of Object.entries(months)) {
          const amt = cellNum(ws.getRow(r).getCell(col).value);
          if (amt !== null && amt > 0) {
            payments++;
            monthMap[code] = (monthMap[code] ?? 0) + amt;
          }
        }
      }
      expected[key] = { students, fees, payments, monthMap };
    }
  }

  // DB actual per (school, route)
  const dbActual = db
    .prepare(
      `SELECT sc.code AS school, r.name AS route,
              COUNT(s.id) AS students,
              COALESCE(SUM(s.monthly_fee), 0) AS fees,
              COALESCE((SELECT COUNT(*) FROM monthly_payments p
                JOIN students s2 ON s2.id = p.student_id
                WHERE s2.route_id = r.id AND p.amount_paid > 0), 0) AS payments
         FROM schools sc
         JOIN routes r ON 1=1
         LEFT JOIN students s ON s.route_id = r.id AND s.school_id = sc.id
         WHERE EXISTS (SELECT 1 FROM students s3 WHERE s3.route_id = r.id AND s3.school_id = sc.id)
         GROUP BY sc.code, r.id
         ORDER BY sc.code, r.name`,
    )
    .all() as { school: string; route: string; students: number; fees: number; payments: number }[];

  console.log("SHEET                               EXPECTED(students/fees/pmts)   DB(students/fees/pmts)   delta");
  console.log("--------------------------------------------------------------------------------------------------");
  for (const row of dbActual) {
    const key = `${row.school}:${row.route}`;
    const exp = expected[key];
    if (!exp) {
      console.log(`${key.padEnd(36)} MISSING_FROM_XLSX                   ${row.students}/${row.fees}/${row.payments}`);
      continue;
    }
    const match =
      exp.students === row.students && Math.abs(exp.fees - row.fees) < 0.5 && exp.payments === row.payments;
    console.log(
      `${key.padEnd(36)} ${String(exp.students).padStart(4)}/${String(exp.fees).padStart(7)}/${String(exp.payments).padStart(4)}   ` +
        `${String(row.students).padStart(4)}/${String(row.fees).padStart(7)}/${String(row.payments).padStart(4)}   ${match ? "OK" : "MISMATCH"}`,
    );
  }

  console.log("");
  const expStud = Object.values(expected).reduce((a, v) => a + v.students, 0);
  const expPmts = Object.values(expected).reduce((a, v) => a + v.payments, 0);
  const expFees = Object.values(expected).reduce((a, v) => a + v.fees, 0);
  const dbStud = (db.prepare("SELECT COUNT(*) c FROM students").get() as { c: number }).c;
  const dbPmts = (db.prepare("SELECT COUNT(*) c FROM monthly_payments").get() as { c: number }).c;
  const dbFees = (db.prepare("SELECT SUM(monthly_fee) c FROM students").get() as { c: number }).c;
  console.log(`TOTAL expected: students=${expStud} fees=${expFees} payments=${expPmts}`);
  console.log(`TOTAL       db: students=${dbStud} fees=${dbFees} payments=${dbPmts}`);

  // Month-wise breakdown in DB vs xlsx
  console.log("\nMonth-wise payment totals (DB vs expected):");
  const dbMonth = db
    .prepare(
      `SELECT month_code, COUNT(*) c, COALESCE(SUM(amount_paid), 0) s
         FROM monthly_payments
         GROUP BY month_code`,
    )
    .all() as { month_code: string; c: number; s: number }[];
  const expMonthCount: Record<string, number> = {};
  const expMonthSum: Record<string, number> = {};
  for (const v of Object.values(expected)) {
    for (const [code, sum] of Object.entries(v.monthMap)) {
      expMonthCount[code] = (expMonthCount[code] ?? 0) + 1; // wrong — should count students, we're counting sheets; fix below
      expMonthSum[code] = (expMonthSum[code] ?? 0) + sum;
    }
  }
  // Recount expected month counts from scratch (per-payment)
  const expMonthPmts: Record<string, number> = {};
  for (const { path: p, school: _s } of FILES) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(p);
    for (const ws of wb.worksheets) {
      const headers: (string | null)[] = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        headers.push(cellText(ws.getRow(3).getCell(c).value));
      }
      const months: Record<string, number> = {};
      let sawApr = false;
      for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        if (!h) continue;
        for (const { code, re } of MONTH_PATTERNS) {
          if (re.test(h)) {
            if (code === "MAR" && !sawApr) break;
            if (!(code in months)) months[code] = c + 1;
            if (code === "APR") sawApr = true;
            break;
          }
        }
      }
      for (let r = 4; r <= ws.rowCount; r++) {
        if (!validSno(ws.getRow(r).getCell(1).value)) continue;
        const name = cellText(ws.getRow(r).getCell(2).value);
        if (!name || /^(student\s*name|total)\b/i.test(name)) continue;
        for (const [code, col] of Object.entries(months)) {
          const amt = cellNum(ws.getRow(r).getCell(col).value);
          if (amt !== null && amt > 0) expMonthPmts[code] = (expMonthPmts[code] ?? 0) + 1;
        }
      }
    }
  }
  for (const row of dbMonth) {
    const ec = expMonthPmts[row.month_code] ?? 0;
    const es = expMonthSum[row.month_code] ?? 0;
    console.log(
      `  ${row.month_code}: db=${row.c}/${row.s}   exp=${ec}/${es}   ${row.c === ec && Math.abs(row.s - es) < 0.5 ? "OK" : "MISMATCH"}`,
    );
  }

  db.close();
})();
