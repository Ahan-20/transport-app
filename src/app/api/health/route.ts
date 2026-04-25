import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Lightweight health check used by Railway to verify the process is alive.
// Must respond quickly — does a single cheap DB ping instead of loading the dashboard.
export async function GET() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT 1 AS ok").get() as { ok: number };
    if (row.ok !== 1) throw new Error("db ping failed");
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: String(err) },
      { status: 500 },
    );
  }
}
