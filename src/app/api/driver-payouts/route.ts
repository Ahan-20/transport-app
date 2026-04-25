import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { parseBody, queuePendingChange, requireSession } from "@/lib/api";
import { MONTHS } from "@/lib/fiscal";
import { bumpQueryCache } from "@/lib/queries";

const schema = z.object({
  driver_id: z.number().int().positive(),
  fiscal_year: z.number().int().min(2000).max(3000),
  month_code: z.enum(MONTHS),
  amount: z.number().nonnegative(),
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
  const existing = db
    .prepare(
      `SELECT id FROM driver_payment_log
        WHERE driver_id = ? AND fiscal_year = ? AND month_code = ?
        ORDER BY id DESC LIMIT 1`,
    )
    .get(driver_id, fiscal_year, month_code) as { id: number } | undefined;

  const audit = db.prepare(
    `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
     VALUES (?, 'driver_payment', ?, ?, ?, ?)`,
  );

  if (existing) {
    const before = db
      .prepare("SELECT * FROM driver_payment_log WHERE id = ?")
      .get(existing.id);
    if (session.user.role !== "admin") {
      const pendingId = queuePendingChange({
        entity: "driver_payment",
        entity_id: existing.id,
        action: "UPDATE",
        before,
        after: { amount, paid_on, mode, notes, driver_id, fiscal_year, month_code },
        user: session.user,
      });
      return NextResponse.json({ ok: true, queued: true, pendingId });
    }
    db.transaction(() => {
      db.prepare(
        `UPDATE driver_payment_log
            SET amount = ?, paid_on = ?, mode = ?, notes = ?, entered_by = ?, entered_at = datetime('now')
          WHERE id = ?`,
      ).run(amount, paid_on, mode ?? null, notes ?? null, session.user.id, existing.id);
      audit.run(
        session.user.id,
        existing.id,
        "UPDATE",
        JSON.stringify(before),
        JSON.stringify({ amount, paid_on, mode, notes }),
      );
    })();
    bumpQueryCache();
    return NextResponse.json({ ok: true, id: existing.id });
  }

  let newId = 0;
  db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO driver_payment_log (driver_id, fiscal_year, month_code, amount, paid_on, mode, notes, entered_by)
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
    audit.run(
      session.user.id,
      newId,
      "CREATE",
      null,
      JSON.stringify({ driver_id, fiscal_year, month_code, amount, paid_on, mode, notes }),
    );
  })();
  bumpQueryCache();
  return NextResponse.json({ ok: true, id: newId });
}
