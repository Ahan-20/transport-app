// One-time DB import endpoint. Admin-only. Reads the SQLite file from the
// request body and overwrites the DB file on disk. Protected by an optional
// shared token (ADMIN_IMPORT_TOKEN env var) so nobody can hit it even if they
// steal an admin session.
//
// After the import completes, the process exits with code 0. Railway restarts
// the container automatically and the new DB file is opened on boot.
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSession } from "@/lib/session";
import { closeDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_PATH =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "transport.db");

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const expectedToken = process.env.ADMIN_IMPORT_TOKEN;
  if (expectedToken) {
    const provided = req.headers.get("x-admin-import-token");
    if (provided !== expectedToken) {
      return NextResponse.json({ error: "Bad token" }, { status: 403 });
    }
  }

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length < 4096 || buf.subarray(0, 15).toString() !== "SQLite format 3") {
    return NextResponse.json(
      { error: "Body does not look like a SQLite file" },
      { status: 400 },
    );
  }

  closeDb();

  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${DB_PATH}.incoming`;
  fs.writeFileSync(tmp, buf);
  // Drop WAL/SHM siblings from the previous DB so SQLite doesn't try to apply
  // them against the freshly swapped-in file.
  for (const ext of ["-wal", "-shm"]) {
    const sibling = `${DB_PATH}${ext}`;
    if (fs.existsSync(sibling)) fs.unlinkSync(sibling);
  }
  fs.renameSync(tmp, DB_PATH);

  // Schedule a process exit so Railway restarts us with the new DB file.
  setTimeout(() => process.exit(0), 200);

  return NextResponse.json({ ok: true, bytes: buf.length });
}
