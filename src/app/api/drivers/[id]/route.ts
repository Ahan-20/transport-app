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
  name: z.string().trim().min(1).optional(),
  contact: z.string().trim().nullable().optional(),
  commission_percent: z.number().min(0).max(100).optional(),
  sub_driver: z.string().trim().nullable().optional(),
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
    table: "drivers",
    entity: "driver",
    id: parsedId.id,
    data,
    user: session.user,
  });
  if (result.error) return result.error;
  return NextResponse.json(result);
}
