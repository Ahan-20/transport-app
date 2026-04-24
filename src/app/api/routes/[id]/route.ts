import { NextResponse } from "next/server";
import { z } from "zod";
import {
  coerceActiveFlag,
  parseBody,
  parseIdParam,
  requireSession,
  stripUndefined,
  updateEntityWithAudit,
} from "@/lib/api";

const schema = z.object({
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  driver_id: z.number().int().positive().optional(),
  vehicle_id: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (session.error) return session.error;

  const parsedId = await parseIdParam(params);
  if (parsedId.error) return parsedId.error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const data = coerceActiveFlag(stripUndefined(parsed.data));
  const result = updateEntityWithAudit({
    table: "routes",
    entity: "route",
    id: parsedId.id,
    data,
    user: session.user,
  });
  if (result.error) return result.error;
  return NextResponse.json(result);
}
