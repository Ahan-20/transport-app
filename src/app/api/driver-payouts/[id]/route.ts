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

// Edit or remove one specific row from driver_payment_log.
//   - Admin: applies the change directly + writes audit_log entry.
//   - Staff: queues a pending_changes row for an admin to approve or reject.

const patchSchema = z.object({
  amount: z.number().positive(),
  paid_on: z.string().trim().min(1),
  mode: z.string().trim().nullable().optional(),
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
    .prepare("SELECT * FROM driver_payment_log WHERE id = ?")
    .get(parsedId.id) as Record<string, unknown> | undefined;
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { amount, paid_on, mode, notes } = parsed.data;
  const after = { amount, paid_on, mode: mode ?? null, notes: notes ?? null };

  if (session.user.role !== "admin") {
    const pendingId = queuePendingChange({
      entity: "driver_payment",
      entity_id: parsedId.id,
      action: "UPDATE",
      before,
      after,
      user: session.user,
    });
    return NextResponse.json({ ok: true, queued: true, pendingId });
  }

  try {
    db.transaction(() => {
      db.prepare(
        `UPDATE driver_payment_log
            SET amount = ?, paid_on = ?, mode = ?, notes = ?,
                entered_by = ?, entered_at = datetime('now')
          WHERE id = ?`,
      ).run(amount, paid_on, mode ?? null, notes ?? null, session.user.id, parsedId.id);
      db.prepare(
        `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
         VALUES (?, 'driver_payment', ?, 'UPDATE', ?, ?)`,
      ).run(
        session.user.id,
        parsedId.id,
        JSON.stringify(before),
        JSON.stringify(after),
      );
    })();
  } catch (err) {
    console.error("[driver-payouts PATCH] update failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database error" },
      { status: 500 },
    );
  }
  bumpQueryCache();
  return NextResponse.json({ ok: true, id: parsedId.id });
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
    .prepare("SELECT * FROM driver_payment_log WHERE id = ?")
    .get(parsedId.id) as Record<string, unknown> | undefined;
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "admin") {
    const pendingId = queuePendingChange({
      entity: "driver_payment",
      entity_id: parsedId.id,
      action: "DELETE",
      before,
      after: { __delete: true },
      user: session.user,
    });
    return NextResponse.json({ ok: true, queued: true, pendingId });
  }

  try {
    db.transaction(() => {
      db.prepare("DELETE FROM driver_payment_log WHERE id = ?").run(parsedId.id);
      db.prepare(
        `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
         VALUES (?, 'driver_payment', ?, 'DELETE', ?, NULL)`,
      ).run(session.user.id, parsedId.id, JSON.stringify(before));
    })();
  } catch (err) {
    console.error("[driver-payouts DELETE] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database error" },
      { status: 500 },
    );
  }
  bumpQueryCache();
  return NextResponse.json({ ok: true });
}
