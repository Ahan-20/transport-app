import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
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
  seedInitialUsers(db);
  return db;
}

// Create initial admin + staff users from env vars on first boot. Runs only
// when the users table is empty, so it never overwrites real accounts. On
// Railway, set INITIAL_ADMIN_PASSWORD and (optionally) INITIAL_STAFF_PASSWORD
// for the first deploy, then you can remove them once the users exist.
function seedInitialUsers(db: Database.Database) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (row.n > 0) return;

  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!adminPassword) return;

  const adminUsername = process.env.INITIAL_ADMIN_USERNAME ?? "admin";
  const adminFullName = process.env.INITIAL_ADMIN_NAME ?? "Administrator";
  db.prepare(
    "INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, 'admin', 1)",
  ).run(adminUsername, bcrypt.hashSync(adminPassword, 10), adminFullName);
  console.log(`[db] seeded admin user "${adminUsername}"`);

  const staffPassword = process.env.INITIAL_STAFF_PASSWORD;
  if (staffPassword) {
    const staffUsername = process.env.INITIAL_STAFF_USERNAME ?? "transport";
    const staffFullName = process.env.INITIAL_STAFF_NAME ?? "Transport Head";
    db.prepare(
      "INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, 'staff', 1)",
    ).run(staffUsername, bcrypt.hashSync(staffPassword, 10), staffFullName);
    console.log(`[db] seeded staff user "${staffUsername}"`);
  }
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
