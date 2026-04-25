import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  coerceActiveFlag,
  parseBody,
  parseIdParam,
  queuePendingChange,
  requireSession,
  stripUndefined,
  updateEntityWithAudit,
} from "@/lib/api";
import { bumpQueryCache } from "@/lib/queries";

const schema = z.object({
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  driver_id: z.number().int().positive().optional(),
  vehicle_id: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (session.error) return session.error;

  const parsedId = await parseIdParam(params);
  if (parsedId.error) return parsedId.error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const data = coerceActiveFlag(stripUndefined(parsed.data));
  const result = updateEntityWithAudit({
    table: "routes",
    entity: "route",
    id: parsedId.id,
    data,
    user: session.user,
  });
  if (result.error) return result.error;
  return NextResponse.json(result);
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

  // Block delete while students still reference this route. The students FK
  // would error at the DB layer with `foreign_keys=ON` anyway, but a clean
  // 409 with a count is much friendlier than "FOREIGN KEY constraint failed".
  const studentCount = (
    db
      .prepare("SELECT COUNT(*) AS n FROM students WHERE route_id = ?")
      .get(parsedId.id) as { n: number }
  ).n;
  if (studentCount > 0) {
    return NextResponse.json(
      {
        error: `${studentCount} student(s) are still on this route. Reassign them first.`,
      },
      { status: 409 },
    );
  }

  const before = db
    .prepare("SELECT * FROM routes WHERE id = ?")
    .get(parsedId.id) as Record<string, unknown> | undefined;
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "admin") {
    const pendingId = queuePendingChange({
      entity: "route",
      entity_id: parsedId.id,
      action: "DELETE",
      before,
      after: { __delete: true },
      user: session.user,
    });
    return NextResponse.json({ ok: true, queued: true, pendingId });
  }

  db.transaction(() => {
    db.prepare("DELETE FROM routes WHERE id = ?").run(parsedId.id);
    db.prepare(
      `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
       VALUES (?, 'route', ?, 'DELETE', ?, NULL)`,
    ).run(session.user.id, parsedId.id, JSON.stringify(before));
  })();
  bumpQueryCache();
  return NextResponse.json({ ok: true });
}
