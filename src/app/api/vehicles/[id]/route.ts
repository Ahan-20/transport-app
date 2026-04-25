import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  coerceActiveFlag,
  parseBody,
  parseIdParam,
  requireSession,
  stripUndefined,
  updateEntityWithAudit,
} from "@/lib/api";
import { bumpQueryCache } from "@/lib/queries";

const schema = z.object({
  plate: z.string().trim().min(1).toUpperCase().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  type: z.string().trim().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (session.error) return session.error;
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const parsedId = await parseIdParam(params);
  if (parsedId.error) return parsedId.error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const data = coerceActiveFlag(stripUndefined(parsed.data));
  const result = updateEntityWithAudit({
    table: "vehicles",
    entity: "vehicle",
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
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const parsedId = await parseIdParam(params);
  if (parsedId.error) return parsedId.error;

  const db = getDb();

  // Block delete if any route still references this vehicle. The FK in routes
  // would error anyway, but this gives a friendly count-based message.
  const routeCount = (
    db
      .prepare("SELECT COUNT(*) AS n FROM routes WHERE vehicle_id = ?")
      .get(parsedId.id) as { n: number }
  ).n;
  if (routeCount > 0) {
    return NextResponse.json(
      {
        error: `${routeCount} route(s) still use this vehicle. Reassign them first.`,
      },
      { status: 409 },
    );
  }

  const before = db
    .prepare("SELECT * FROM vehicles WHERE id = ?")
    .get(parsedId.id) as Record<string, unknown> | undefined;
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.transaction(() => {
    db.prepare("DELETE FROM vehicles WHERE id = ?").run(parsedId.id);
    db.prepare(
      `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
       VALUES (?, 'vehicle', ?, 'DELETE', ?, NULL)`,
    ).run(session.user.id, parsedId.id, JSON.stringify(before));
  })();
  bumpQueryCache();
  return NextResponse.json({ ok: true });
}
