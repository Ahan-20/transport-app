import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { queuePendingChange, requireSession } from "@/lib/api";
import { MONTHS } from "@/lib/fiscal";

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

  const selectBefore = db.prepare(
    "SELECT amount_paid, paid_on, mode, ref_no, notes FROM monthly_payments WHERE student_id=? AND fiscal_year=? AND month_code=?",
  );
  const upsert = db.prepare(`
    INSERT INTO monthly_payments (student_id, fiscal_year, month_code, amount_paid, paid_on, mode, ref_no, notes, entered_by)
    VALUES (@studentId, @fy, @month, @amount, @paidOn, @mode, @refNo, @notes, @userId)
    ON CONFLICT(student_id, fiscal_year, month_code)
    DO UPDATE SET amount_paid = excluded.amount_paid,
                  paid_on = excluded.paid_on,
                  mode = COALESCE(excluded.mode, monthly_payments.mode),
                  ref_no = COALESCE(excluded.ref_no, monthly_payments.ref_no),
                  notes = COALESCE(excluded.notes, monthly_payments.notes),
                  entered_by = excluded.entered_by,
                  entered_at = datetime('now')
  `);
  const audit = db.prepare(
    "INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json) VALUES (?, 'monthly_payment', ?, ?, ?, ?)",
  );

  let applied = 0;
  let queued = 0;

  const run = db.transaction((entries: z.infer<typeof entrySchema>[]) => {
    for (const e of entries) {
      const before = selectBefore.get(e.studentId, e.fy, e.month) as
        | { amount_paid: number | null; paid_on: string | null; mode: string | null; ref_no: string | null; notes: string | null }
        | undefined;

      const existingAmount = before?.amount_paid ?? null;
      const isEdit =
        existingAmount !== null &&
        existingAmount > 0 &&
        (e.amount !== existingAmount || (e.mode && e.mode !== before?.mode));

      if (session.user.role !== "admin" && isEdit) {
        queuePendingChange({
          entity: "monthly_payment",
          entity_id: e.studentId,
          action: "UPDATE",
          before,
          after: { ...e, paidOn: e.paidOn ?? today, __fy: e.fy, __month: e.month },
          user: session.user,
        });
        queued++;
        continue;
      }

      upsert.run({
        studentId: e.studentId,
        fy: e.fy,
        month: e.month,
        amount: e.amount,
        paidOn: e.paidOn ?? (e.amount && e.amount > 0 ? today : null),
        mode: e.mode ?? null,
        refNo: e.refNo ?? null,
        notes: e.notes ?? null,
        userId,
      });
      const action = before == null ? "CREATE" : "UPDATE";
      audit.run(
        userId,
        e.studentId,
        action,
        before ? JSON.stringify({ amount_paid: before.amount_paid }) : null,
        JSON.stringify({ amount_paid: e.amount, fy: e.fy, month: e.month }),
      );
      applied++;
    }
  });
  run(parsed.data.entries);

  return NextResponse.json({ ok: true, saved: applied, queued });
}
