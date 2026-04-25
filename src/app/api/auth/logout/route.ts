import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const session = await getSession();
  session.destroy();
  // Use the request's own origin so this works on Railway, localhost, etc.
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
