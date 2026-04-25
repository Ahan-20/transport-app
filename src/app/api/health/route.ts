import { NextResponse } from "next/server";

// Lightweight liveness check used by Railway. Intentionally does NOT touch the
// database — Railway only needs to know the Node process is responsive, and
// touching the DB would block on initialization on every probe.
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
