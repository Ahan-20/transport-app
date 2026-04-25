import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { parseBody, requireSession } from "@/lib/api";
import { MONTHS } from "@/lib/fiscal";
import { bumpQueryCache } from "@/lib/queries";

// Each POST creates a NEW driver_payment_log row. A driver may receive any
// number of payments per (fiscal_year, month_code) — for example multiple
// installments. Edits and deletes go through PATCH / DELETE on the [id] route.
const schema = z.object({
  driver_id: z.number().int().positive(),
  fiscal_year: z.number().int().min(2000).max(3000),
  month_code: z.enum(MONTHS),
  amount: z.number().positive(),
  paid_on: z.string().trim().min(1),
  mode: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  if (session.error) return session.error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const { driver_id, fiscal_year, month_code, amount, paid_on, mode, notes } = parsed.data;
  const db = getDb();

  let newId = 0;
  db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO driver_payment_log
           (driver_id, fiscal_year, month_code, amount, paid_on, mode, notes, entered_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        driver_id,
        fiscal_year,
        month_code,
        amount,
        paid_on,
        mode ?? null,
        notes ?? null,
        session.user.id,
      );
    newId = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
       VALUES (?, 'driver_payment', ?, 'CREATE', NULL, ?)`,
    ).run(
      session.user.id,
      newId,
      JSON.stringify({ driver_id, fiscal_year, month_code, amount, paid_on, mode, notes }),
    );
  })();
  bumpQueryCache();
  return NextResponse.json({ ok: true, id: newId });
}
