import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

// Streams a clean SQLite snapshot of the production DB.
//
// Auth: accepts EITHER
//   1) an admin browser session (so a logged-in admin can click a button), or
//   2) Authorization: Bearer ${BACKUP_TOKEN}  (so a cron job from a Mac
//      can fetch the file without a session).
//
// BACKUP_TOKEN must be set as a Railway env var. Generate with:
//   openssl rand -hex 32
// then paste it into Railway → Variables. Anyone with that token can
// download the full database — treat it like a password.
//
// Snapshot mechanism: SQLite's `VACUUM INTO` produces a consistent,
// defragmented copy without locking the live DB. Safe to run while the
// app is serving requests.

export async function GET(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.BACKUP_TOKEN;
  const tokenOk =
    expected && auth.startsWith("Bearer ") && auth.slice(7) === expected;

  let sessionOk = false;
  if (!tokenOk) {
    const session = await getSession();
    sessionOk = session.user?.role === "admin";
  }

  if (!tokenOk && !sessionOk) {
    return NextResponse.json(
      { error: "Admin session or BACKUP_TOKEN required" },
      { status: 401 },
    );
  }

  // ── Snapshot ───────────────────────────────────────────────────────
  const db = getDb();
  const tempPath = path.join(
    os.tmpdir(),
    `transport-backup-${Date.now()}-${process.pid}.db`,
  );
  try {
    // Quote the path with single-quotes; SQLite's VACUUM INTO needs a
    // string literal here. tempPath is server-controlled (no user input).
    db.exec(`VACUUM INTO '${tempPath.replace(/'/g, "''")}'`);

    const buffer = fs.readFileSync(tempPath);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="transport-${today}.db"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup failed" },
      { status: 500 },
    );
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      /* file may not exist if VACUUM failed; ignore */
    }
  }
}
