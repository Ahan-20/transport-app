import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/api";
import { MONTHS } from "@/lib/fiscal";
import { bumpQueryCache } from "@/lib/queries";

// Each entry = one new INSTALLMENT toward a (student, fy, month) cell.
// Multiple installments per cell are normal — the cell total is the SUM.
//
// `amount` of 0 or null is treated as "skip" — we don't store empty-zero
// rows because they'd inflate the SUM logic.
//
// Non-admin users can freely ADD new installments (matches the existing
// "create new payment" workflow). Edits/deletes of EXISTING installments
// go through PATCH/DELETE /api/payments/[id], where the staff path queues
// a pending change for admin approval.
const entrySchema = z.object({
  studentId: z.number().int().positive(),
  fy: z.number().int(),
  month: z.enum(MONTHS),
  amount: z.number().nullable(),
  paidOn: z.string().nullable().optional(),
  mode: z.enum(["CASH", "CHEQUE", "BANK", "UPI"]).nullable().optional(),
  refNo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const payload = z.object({
  entries: z.array(entrySchema).min(1).max(500),
});

export async function POST(req: Request) {
  const session = await requireSession();
  if (session.error) return session.error;

  const body = await req.json().catch(() => null);
  const parsed = payload.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bad input" }, { status: 400 });
  }

  const db = getDb();
  const userId = session.user.id;
  const today = new Date().toISOString().slice(0, 10);

  const insert = db.prepare(`
    INSERT INTO monthly_payments
      (student_id, fiscal_year, month_code, amount_paid, paid_on, mode, ref_no, notes, entered_by)
    VALUES (@studentId, @fy, @month, @amount, @paidOn, @mode, @refNo, @notes, @userId)
  `);
  const audit = db.prepare(
    "INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json) VALUES (?, 'monthly_payment', ?, ?, ?, ?)",
  );

  let applied = 0;
  let skipped = 0;

  const run = db.transaction((entries: z.infer<typeof entrySchema>[]) => {
    for (const e of entries) {
      // Skip empty/zero entries — the bulk-entry UI uses an empty input as
      // "no new installment for this student", so we must not record those.
      if (e.amount == null || e.amount === 0) {
        skipped++;
        continue;
      }

      const info = insert.run({
        studentId: e.studentId,
        fy: e.fy,
        month: e.month,
        amount: e.amount,
        paidOn: e.paidOn ?? today,
        mode: e.mode ?? null,
        refNo: e.refNo ?? null,
        notes: e.notes ?? null,
        userId,
      });
      audit.run(
        userId,
        Number(info.lastInsertRowid),
        "CREATE",
        null,
        JSON.stringify({
          student_id: e.studentId,
          fiscal_year: e.fy,
          month_code: e.month,
          amount_paid: e.amount,
          paid_on: e.paidOn ?? today,
          mode: e.mode ?? null,
        }),
      );
      applied++;
    }
  });
  run(parsed.data.entries);

  if (applied > 0) bumpQueryCache();

  // `queued` is kept at 0 for forward compat with existing clients that
  // read it. Real edits/deletes of past installments go through PATCH /
  // DELETE /api/payments/[id], where the staff path queues approvals.
  return NextResponse.json({ ok: true, saved: applied, skipped, queued: 0 });
}
