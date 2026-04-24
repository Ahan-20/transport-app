import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// On Railway (or any host with a mounted volume), set DATABASE_PATH to a path
// inside the volume, e.g. "/app/data/transport.db". Locally this falls back to
// ./data/transport.db so nothing changes for dev.
const DB_PATH =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "transport.db");
const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare("SELECT name FROM _migrations").all().map((r) => (r as { name: string }).name),
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    });
    tx();
    console.log(`[db] applied migration ${file}`);
  }

  _db = db;
  return db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
