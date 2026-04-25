import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { parseBody, requireSession } from "@/lib/api";
import { bumpQueryCache } from "@/lib/queries";

// Create a new route. Routes typically don't change often, so this is admin-
// only — non-admin POSTs are rejected (matches the existing "create
// student"-style direct-write pattern but with stricter access since a route
// reshapes payouts and dashboards). Edits + deletes go through the [id]
// route and follow the standard admin-direct / staff-via-approval split.
const schema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  driver_id: z.number().int().positive(),
  vehicle_id: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  if (session.error) return session.error;
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const { code, name, driver_id, vehicle_id, active } = parsed.data;
  const db = getDb();

  // Reject duplicate codes early — the index doesn't enforce uniqueness, but
  // duplicate codes confuse every dashboard query that uses code as a label.
  const existing = db
    .prepare("SELECT id FROM routes WHERE code = ?")
    .get(code) as { id: number } | undefined;
  if (existing) {
    return NextResponse.json(
      { error: `Route code "${code}" already exists.` },
      { status: 409 },
    );
  }

  let newId = 0;
  db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO routes (code, name, driver_id, vehicle_id, active)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(code, name, driver_id, vehicle_id ?? null, active === false ? 0 : 1);
    newId = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
       VALUES (?, 'route', ?, 'CREATE', NULL, ?)`,
    ).run(
      session.user.id,
      newId,
      JSON.stringify({ code, name, driver_id, vehicle_id, active: active !== false }),
    );
  })();
  bumpQueryCache();
  return NextResponse.json({ ok: true, id: newId });
}
