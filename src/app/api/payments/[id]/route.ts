import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  parseBody,
  parseIdParam,
  queuePendingChange,
  requireSession,
} from "@/lib/api";
import { bumpQueryCache } from "@/lib/queries";

// PATCH/DELETE for a single payment INSTALLMENT (one row in monthly_payments).
//
// Permission split (mirrors the rest of the app):
//   - admin: applies the change directly + writes audit_log
//   - staff: queues a pending change for an admin to approve (kept consistent
//     with how /api/students/[id] PATCH and driver-payment edits work)

const patchSchema = z.object({
  amount: z.number().positive(),
  paid_on: z.string().trim().min(1),
  mode: z.enum(["CASH", "CHEQUE", "BANK", "UPI"]).nullable().optional(),
  ref_no: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (session.error) return session.error;

  const parsedId = await parseIdParam(params);
  if (parsedId.error) return parsedId.error;

  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;

  const db = getDb();
  const before = db
    .prepare("SELECT * FROM monthly_payments WHERE id = ?")
    .get(parsedId.id) as Record<string, unknown> | undefined;
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "admin") {
    const pendingId = queuePendingChange({
      entity: "monthly_payment",
      entity_id: parsedId.id,
      action: "UPDATE",
      before,
      after: parsed.data,
      user: session.user,
    });
    return NextResponse.json({ ok: true, queued: true, pendingId });
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE monthly_payments
          SET amount_paid = ?, paid_on = ?, mode = ?, ref_no = ?, notes = ?,
              entered_by = ?, entered_at = datetime('now')
        WHERE id = ?`,
    ).run(
      parsed.data.amount,
      parsed.data.paid_on,
      parsed.data.mode ?? null,
      parsed.data.ref_no ?? null,
      parsed.data.notes ?? null,
      session.user.id,
      parsedId.id,
    );
    db.prepare(
      `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
       VALUES (?, 'monthly_payment', ?, 'UPDATE', ?, ?)`,
    ).run(
      session.user.id,
      parsedId.id,
      JSON.stringify(before),
      JSON.stringify(parsed.data),
    );
  })();
  bumpQueryCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (session.error) return session.error;

  const parsedId = await parseIdParam(params);
  if (parsedId.error) return parsedId.error;

  const db = getDb();
  const before = db
    .prepare("SELECT * FROM monthly_payments WHERE id = ?")
    .get(parsedId.id) as Record<string, unknown> | undefined;
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "admin") {
    const pendingId = queuePendingChange({
      entity: "monthly_payment",
      entity_id: parsedId.id,
      action: "DELETE",
      before,
      after: { __delete: true },
      user: session.user,
    });
    return NextResponse.json({ ok: true, queued: true, pendingId });
  }

  db.transaction(() => {
    db.prepare("DELETE FROM monthly_payments WHERE id = ?").run(parsedId.id);
    db.prepare(
      `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
       VALUES (?, 'monthly_payment', ?, 'DELETE', ?, NULL)`,
    ).run(session.user.id, parsedId.id, JSON.stringify(before));
  })();
  bumpQueryCache();
  return NextResponse.json({ ok: true });
}
