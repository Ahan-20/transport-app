import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  applyPendingChange,
  parseBody,
  parseIdParam,
  requireSession,
} from "@/lib/api";

const schema = z.object({
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().nullable().optional(),
});

export async function POST(
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

  const db = getDb();
  const pending = db
    .prepare("SELECT status FROM pending_changes WHERE id = ?")
    .get(parsedId.id) as { status: string } | undefined;
  if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pending.status !== "pending") {
    return NextResponse.json({ error: `Already ${pending.status}` }, { status: 400 });
  }

  if (parsed.data.decision === "approve") {
    try {
      applyPendingChange(parsedId.id, session.user);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to apply" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  db.prepare(
    "UPDATE pending_changes SET status = 'rejected', decided_by = ?, decided_at = datetime('now'), decision_notes = ? WHERE id = ?",
  ).run(session.user.id, parsed.data.notes ?? null, parsedId.id);
  return NextResponse.json({ ok: true });
}
