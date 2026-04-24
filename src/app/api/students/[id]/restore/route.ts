import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseIdParam, queuePendingChange, requireSession } from "@/lib/api";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (session.error) return session.error;

  const parsedId = await parseIdParam(params);
  if (parsedId.error) return parsedId.error;

  const db = getDb();
  const before = db
    .prepare("SELECT * FROM students WHERE id = ?")
    .get(parsedId.id) as Record<string, unknown> | undefined;
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "admin") {
    const pendingId = queuePendingChange({
      entity: "student",
      entity_id: parsedId.id,
      action: "UPDATE",
      before,
      after: { status: "ACTIVE", __restore: true },
      user: session.user,
    });
    return NextResponse.json({ ok: true, queued: true, pendingId });
  }

  db.prepare(
    `UPDATE students
        SET status = 'ACTIVE', archived_at = NULL, updated_at = datetime('now')
      WHERE id = ?`,
  ).run(parsedId.id);

  db.prepare(
    "INSERT INTO audit_log (user_id, entity, entity_id, action, after_json) VALUES (?, 'student', ?, 'RESTORE', ?)",
  ).run(session.user.id, parsedId.id, JSON.stringify({ status: "ACTIVE" }));

  return NextResponse.json({ ok: true });
}
