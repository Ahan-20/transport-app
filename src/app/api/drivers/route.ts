import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { parseBody, requireSession } from "@/lib/api";
import { bumpQueryCache } from "@/lib/queries";

// Create a new driver. Admin-only for the same reason routes are: adding a
// driver reshapes payouts and dashboards. Edits go through the [id] route
// and follow the standard admin-direct / staff-via-approval split.
const schema = z.object({
  name: z.string().trim().min(1),
  contact: z.string().trim().nullable().optional(),
  commission_percent: z.number().min(0).max(100),
  sub_driver: z.string().trim().nullable().optional(),
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

  const { name, contact, commission_percent, sub_driver, active } = parsed.data;
  const db = getDb();

  // Reject duplicate names early — the drivers table has a UNIQUE index on
  // name, and a bare INSERT would give a cryptic SQLITE_CONSTRAINT error.
  const existing = db
    .prepare("SELECT id FROM drivers WHERE name = ?")
    .get(name) as { id: number } | undefined;
  if (existing) {
    return NextResponse.json(
      { error: `A driver named "${name}" already exists.` },
      { status: 409 },
    );
  }

  let newId = 0;
  db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO drivers (name, contact, commission_percent, sub_driver, active)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        name,
        contact ?? null,
        commission_percent,
        sub_driver ?? null,
        active === false ? 0 : 1,
      );
    newId = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO audit_log (user_id, entity, entity_id, action, before_json, after_json)
       VALUES (?, 'driver', ?, 'CREATE', NULL, ?)`,
    ).run(
      session.user.id,
      newId,
      JSON.stringify({ name, contact, commission_percent, sub_driver, active: active !== false }),
    );
  })();
  bumpQueryCache();
  return NextResponse.json({ ok: true, id: newId });
}
