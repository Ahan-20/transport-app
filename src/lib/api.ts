import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { getDb } from "./db";
import { bumpQueryCache } from "./queries";
import { getSession, type SessionUser } from "./session";

export async function requireSession() {
  const session = await getSession();
  if (!session.user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user: session.user, error: null };
}

export async function parseIdParam(params: Promise<{ id: string }>) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return {
      id: null,
      error: NextResponse.json({ error: "Bad id" }, { status: 400 }),
    };
  }
  return { id, error: null };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Bad input" },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data, error: null };
}

type AuditableEntity = "student" | "driver" | "route" | "vehicle";
type AuditableTable = "students" | "drivers" | "routes" | "vehicles";

export function applyUpdate(params: {
  table: AuditableTable;
  entity: AuditableEntity;
  id: number;
  data: Record<string, unknown>;
  user: SessionUser;
  extraSet?: string;
}) {
  const { table, entity, id, data, user, extraSet } = params;
  const keys = Object.keys(data);
  if (!keys.length) return;

  const db = getDb();
  const before = db
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  if (!before) throw new Error("Not found");

  const setClauses = [
    ...keys.map((k) => `${k} = @${k}`),
    ...(extraSet ? [extraSet] : []),
  ].join(", ");
  const update = db.prepare(`UPDATE ${table} SET ${setClauses} WHERE id = @id`);
  const audit = db.prepare(
    `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
     VALUES (?, ?, ?, 'UPDATE', ?, ?)`,
  );
  db.transaction(() => {
    update.run({ ...data, id });
    audit.run(user.id, entity, id, JSON.stringify(before), JSON.stringify(data));
  })();
  bumpQueryCache();
}

export function updateEntityWithAudit(params: {
  table: AuditableTable;
  entity: AuditableEntity;
  id: number;
  data: Record<string, unknown>;
  user: SessionUser;
  extraSet?: string;
}) {
  const { table, entity, id, data, user, extraSet } = params;
  const keys = Object.keys(data);
  if (!keys.length) return { ok: true as const };

  const db = getDb();
  const before = db
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  if (!before) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  if (user.role !== "admin") {
    const info = db
      .prepare(
        `INSERT INTO pending_changes (requested_by, entity, entity_id, action, before_json, after_json)
         VALUES (?, ?, ?, 'UPDATE', ?, ?)`,
      )
      .run(user.id, entity, id, JSON.stringify(before), JSON.stringify({ ...data, __extraSet: extraSet ?? null }));
    return { ok: true as const, queued: true, pendingId: Number(info.lastInsertRowid) };
  }

  applyUpdate({ table, entity, id, data, user, extraSet });
  return { ok: true as const };
}

export function queuePendingChange(params: {
  entity: string;
  entity_id: number | null;
  action: "CREATE" | "UPDATE" | "DELETE";
  before: unknown;
  after: unknown;
  user: SessionUser;
}) {
  const { entity, entity_id, action, before, after, user } = params;
  const info = getDb()
    .prepare(
      `INSERT INTO pending_changes (requested_by, entity, entity_id, action, before_json, after_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(user.id, entity, entity_id, action, JSON.stringify(before), JSON.stringify(after));
  return Number(info.lastInsertRowid);
}

export function applyPendingChange(pendingId: number, admin: SessionUser) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM pending_changes WHERE id = ? AND status = 'pending'")
    .get(pendingId) as
    | {
        id: number;
        entity: string;
        entity_id: number | null;
        action: string;
        after_json: string;
      }
    | undefined;
  if (!row) throw new Error("Pending change not found or already decided");
  let after: Record<string, unknown>;
  try {
    after = JSON.parse(row.after_json) as Record<string, unknown>;
  } catch {
    throw new Error("Pending change has malformed JSON and cannot be applied");
  }

  if (row.entity === "student" && row.entity_id != null) {
    if (after.__archive) {
      db.prepare(
        `UPDATE students SET status = ?, archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      ).run(after.status, row.entity_id);
    } else if (after.__restore) {
      db.prepare(
        `UPDATE students SET status = 'ACTIVE', archived_at = NULL, updated_at = datetime('now') WHERE id = ?`,
      ).run(row.entity_id);
    } else {
      const { __extraSet, ...data } = after;
      applyUpdate({
        table: "students",
        entity: "student",
        id: row.entity_id,
        data,
        user: admin,
        extraSet: (__extraSet as string | null) ?? "updated_at = datetime('now')",
      });
    }
  } else if (row.entity === "driver" && row.entity_id != null) {
    const { __extraSet, ...data } = after;
    applyUpdate({
      table: "drivers",
      entity: "driver",
      id: row.entity_id,
      data,
      user: admin,
      extraSet: (__extraSet as string | null) ?? undefined,
    });
  } else if (row.entity === "route" && row.entity_id != null) {
    if (row.action === "DELETE") {
      // Re-check the student count at apply time — staff might have queued
      // the delete when the route was empty, but a student could have been
      // re-assigned to it since.
      const studentCount = (
        db
          .prepare("SELECT COUNT(*) AS n FROM students WHERE route_id = ?")
          .get(row.entity_id) as { n: number }
      ).n;
      if (studentCount > 0) {
        throw new Error(
          `${studentCount} student(s) are now on this route. Reassign them before approving the delete.`,
        );
      }
      db.prepare("DELETE FROM routes WHERE id = ?").run(row.entity_id);
    } else {
      const { __extraSet, ...data } = after;
      applyUpdate({
        table: "routes",
        entity: "route",
        id: row.entity_id,
        data,
        user: admin,
        extraSet: (__extraSet as string | null) ?? undefined,
      });
    }
  } else if (row.entity === "monthly_payment" && row.entity_id != null) {
    if (row.action === "DELETE" || after.__delete) {
      // entity_id is the installment row id (since /api/payments/[id])
      db.prepare("DELETE FROM monthly_payments WHERE id = ?").run(row.entity_id);
    } else if (after.__fy != null && after.__month != null) {
      // Legacy pending changes from before the installment refactor — the
      // old POST handler queued these with entity_id = student_id and the
      // (fy, month) embedded in `after`. They become a fresh installment.
      const fy = after.__fy as number;
      const month = after.__month as string;
      db.prepare(
        `INSERT INTO monthly_payments (student_id, fiscal_year, month_code, amount_paid, paid_on, mode, ref_no, notes, entered_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.entity_id,
        fy,
        month,
        after.amount ?? null,
        after.paidOn ?? null,
        after.mode ?? null,
        after.refNo ?? null,
        after.notes ?? null,
        admin.id,
      );
    } else {
      // New shape: entity_id is the installment row id; PATCH the row.
      db.prepare(
        `UPDATE monthly_payments
            SET amount_paid = ?, paid_on = ?, mode = ?, ref_no = ?, notes = ?,
                entered_by = ?, entered_at = datetime('now')
          WHERE id = ?`,
      ).run(
        after.amount as number,
        after.paid_on as string,
        (after.mode as string) ?? null,
        (after.ref_no as string) ?? null,
        (after.notes as string) ?? null,
        admin.id,
        row.entity_id,
      );
    }
  } else if (row.entity === "driver_payment" && row.entity_id != null) {
    if (row.action === "DELETE") {
      db.prepare("DELETE FROM driver_payment_log WHERE id = ?").run(row.entity_id);
    } else {
      db.prepare(
        `UPDATE driver_payment_log
            SET amount = ?, paid_on = ?, mode = ?, notes = ?, entered_by = ?, entered_at = datetime('now')
          WHERE id = ?`,
      ).run(
        after.amount as number,
        after.paid_on as string,
        (after.mode as string) ?? null,
        (after.notes as string) ?? null,
        admin.id,
        row.entity_id,
      );
    }
  } else {
    throw new Error(`Unknown entity type: ${row.entity}`);
  }

  db.prepare(
    "UPDATE pending_changes SET status = 'approved', decided_by = ?, decided_at = datetime('now') WHERE id = ?",
  ).run(admin.id, pendingId);

  bumpQueryCache();
}

export function coerceActiveFlag(data: Record<string, unknown>) {
  if ("active" in data && typeof data.active === "boolean") {
    data.active = data.active ? 1 : 0;
  }
  return data;
}

export function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
