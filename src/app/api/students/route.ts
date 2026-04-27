import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { bumpQueryCache } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { MONTHS } from "@/lib/fiscal";

const schema = z.object({
  name: z.string().trim().min(1),
  name_hindi: z.string().trim().nullable().optional(),
  class: z.string().trim().nullable().optional(),
  school_id: z.number().int().positive(),
  driver_id: z.number().int().positive(),
  route_id: z.number().int().positive().nullable().optional(),
  pickup_address: z.string().trim().nullable().optional(),
  monthly_fee: z.number().nonnegative(),
  contact: z.string().trim().nullable().optional(),
  sno: z.number().int().nullable().optional(),
  start_month: z.enum(MONTHS).nullable().optional(),
  end_month: z.enum(MONTHS).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Bad input" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const db = getDb();
  const userId = session.user.id;

  const insert = db.prepare(
    `INSERT INTO students
       (school_id, sno, name, name_hindi, class, driver_id, route_id,
        pickup_address, monthly_fee, contact, start_month, end_month, status)
     VALUES (@school_id, @sno, @name, @name_hindi, @class, @driver_id, @route_id,
             @pickup_address, @monthly_fee, @contact, @start_month, @end_month, 'ACTIVE')`,
  );
  const audit = db.prepare(
    "INSERT INTO audit_log (user_id, entity, entity_id, action, after_json) VALUES (?, 'student', ?, 'CREATE', ?)",
  );

  const tx = db.transaction(() => {
    const res = insert.run({
      school_id: d.school_id,
      sno: d.sno ?? null,
      name: d.name,
      name_hindi: d.name_hindi ?? null,
      class: d.class ?? null,
      driver_id: d.driver_id,
      route_id: d.route_id ?? null,
      pickup_address: d.pickup_address ?? null,
      monthly_fee: d.monthly_fee,
      contact: d.contact ?? null,
      start_month: d.start_month ?? null,
      end_month: d.end_month ?? null,
    });
    const id = Number(res.lastInsertRowid);
    audit.run(userId, id, JSON.stringify(d));
    return id;
  });
  const id = tx();
  bumpQueryCache();
  return NextResponse.json({ ok: true, id });
}
