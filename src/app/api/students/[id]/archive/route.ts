import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { parseIdParam, queuePendingChange, requireSession } from "@/lib/api";

const schema = z.object({
  status: z.enum(["LEFT", "SUSPENDED"]).default("LEFT"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (session.error) return session.error;

  const parsedId = await parseIdParam(params);
  if (parsedId.error) return parsedId.error;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const status = parsed.success ? parsed.data.status : "LEFT";

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
      after: { status, __archive: true },
      user: session.user,
    });
    return NextResponse.json({ ok: true, queued: true, pendingId });
  }

  db.prepare(
    `UPDATE students
        SET status = ?, archived_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`,
  ).run(status, parsedId.id);

  db.prepare(
    "INSERT INTO audit_log (user_id, entity, entity_id, action, after_json) VALUES (?, 'student', ?, 'ARCHIVE', ?)",
  ).run(session.user.id, parsedId.id, JSON.stringify({ status }));

  return NextResponse.json({ ok: true });
}
