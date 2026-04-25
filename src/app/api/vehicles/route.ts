import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { parseBody, requireSession } from "@/lib/api";
import { bumpQueryCache } from "@/lib/queries";

// Vehicle CRUD is admin-only. The set of vehicles is small and changes
// rarely (when a new bus joins or one is retired); staff don't need to add
// or remove vehicles in the normal payment workflow.
const schema = z.object({
  plate: z.string().trim().min(1).toUpperCase(),
  capacity: z.number().int().positive().nullable().optional(),
  type: z.string().trim().nullable().optional(),
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

  const { plate, capacity, type, active } = parsed.data;
  const db = getDb();

  // The schema has UNIQUE on plate — pre-check for a clean error message
  // instead of a SQLITE_CONSTRAINT.
  const existing = db
    .prepare("SELECT id FROM vehicles WHERE plate = ?")
    .get(plate) as { id: number } | undefined;
  if (existing) {
    return NextResponse.json(
      { error: `Vehicle plate "${plate}" already exists.` },
      { status: 409 },
    );
  }

  let newId = 0;
  db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO vehicles (plate, capacity, type, active)
         VALUES (?, ?, ?, ?)`,
      )
      .run(plate, capacity ?? null, type ?? null, active === false ? 0 : 1);
    newId = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
       VALUES (?, 'vehicle', ?, 'CREATE', NULL, ?)`,
    ).run(
      session.user.id,
      newId,
      JSON.stringify({ plate, capacity, type, active: active !== false }),
    );
  })();
  bumpQueryCache();
  return NextResponse.json({ ok: true, id: newId });
}
