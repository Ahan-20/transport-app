import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { MONTHS, MONTH_LABEL } from "@/lib/fiscal";
import {
  parseBody,
  parseIdParam,
  queuePendingChange,
  replaceMonthFees,
  requireSession,
} from "@/lib/api";
import { bumpQueryCache, getMonthFeeOverrides } from "@/lib/queries";

// Saves a student's 12-month fee grid for one fiscal year. `fees` is the full
// set of months that differ from the default monthly_fee; any month left out
// goes back to the default.
const schema = z.object({
  fiscal_year: z.number().int(),
  fees: z.partialRecord(z.enum(MONTHS), z.number().nonnegative()),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (session.error) return session.error;

  const parsedId = await parseIdParam(params);
  if (parsedId.error) return parsedId.error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const id = parsedId.id;
  const { fiscal_year, fees } = parsed.data;
  const student = getDb()
    .prepare("SELECT monthly_fee FROM students WHERE id = ?")
    .get(id) as { monthly_fee: number } | undefined;
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "admin") {
    // Readable rows for /approvals ("Fee Nov: 1000 → 1200"); __month_fees is
    // what gets applied on approval.
    const current = getMonthFeeOverrides(fiscal_year, [id]).get(id) ?? {};
    const before: Record<string, number> = {};
    const after: Record<string, unknown> = { __month_fees: { fiscal_year, fees } };
    for (const m of MONTHS) {
      const from = current[m] ?? student.monthly_fee;
      const to = fees[m] ?? student.monthly_fee;
      if (from !== to) {
        before[`Fee ${MONTH_LABEL[m]}`] = from;
        after[`Fee ${MONTH_LABEL[m]}`] = to;
      }
    }
    const pendingId = queuePendingChange({
      entity: "student",
      entity_id: id,
      action: "UPDATE",
      before,
      after,
      user: session.user,
    });
    return NextResponse.json({ ok: true, queued: true, pendingId });
  }

  replaceMonthFees(id, fiscal_year, fees, session.user);
  bumpQueryCache();
  return NextResponse.json({ ok: true });
}
