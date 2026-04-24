import { NextResponse } from "next/server";
import { z } from "zod";
import {
  parseBody,
  parseIdParam,
  requireSession,
  stripUndefined,
  updateEntityWithAudit,
} from "@/lib/api";

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  name_hindi: z.string().trim().nullable().optional(),
  class: z.string().trim().nullable().optional(),
  school_id: z.number().int().positive().optional(),
  driver_id: z.number().int().positive().optional(),
  route_id: z.number().int().positive().nullable().optional(),
  pickup_address: z.string().trim().nullable().optional(),
  monthly_fee: z.number().nonnegative().optional(),
  contact: z.string().trim().nullable().optional(),
  sno: z.number().int().nullable().optional(),
  status: z.enum(["ACTIVE", "LEFT", "SUSPENDED"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (session.error) return session.error;

  const parsedId = await parseIdParam(params);
  if (parsedId.error) return parsedId.error;

  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;

  const data = stripUndefined(parsed.data);
  const result = updateEntityWithAudit({
    table: "students",
    entity: "student",
    id: parsedId.id,
    data,
    user: session.user,
    extraSet: "updated_at = datetime('now')",
  });
  if (result.error) return result.error;
  return NextResponse.json(result);
}
