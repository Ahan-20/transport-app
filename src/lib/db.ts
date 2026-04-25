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
let _shutdownRegistered = false;

// Prepared-statement cache. better-sqlite3's db.prepare() compiles SQL to
// bytecode on every call; reusing statements skips that work.
const _stmtCache = new Map<string, Database.Statement>();

export function prep(sql: string): Database.Statement {
  let s = _stmtCache.get(sql);
  if (!s) {
    s = getDb().prepare(sql);
    _stmtCache.set(sql, s);
  }
  return s;
}

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);

  // Performance + reliability tuning. Each pragma is intentional:
  //   journal_mode=WAL — readers don't block the writer; survives crashes.
  //   synchronous=NORMAL — fsync less aggressively; still durable across
  //     app crashes, only loses last txn on a full OS crash. Massive write
  //     speedup over the default FULL.
  //   foreign_keys=ON — actually enforces FK constraints (off by default).
  //   busy_timeout=5000 — wait up to 5s for a lock instead of erroring out
  //     immediately; covers brief contention without changing app code.
  //   temp_store=MEMORY — temp B-trees for sorts/joins live in RAM, not /tmp.
  //   cache_size=-16000 — 16MB page cache (negative value = KB). The default
  //     2MB is way too small for our query patterns.
  //   mmap_size=268435456 — memory-map up to 256MB of the DB file; lets the
  //     OS page cache do the heavy lifting for reads.
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("temp_store = MEMORY");
  db.pragma("cache_size = -16000");
  db.pragma("mmap_size = 268435456");

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
  registerShutdownHandlers();
  seedInitialUsers(db);
  return db;
}

// On SIGTERM (Railway redeploys, container stops) we want to:
//   1) Truncate the WAL so the next startup is fast and the DB file is clean.
//   2) Close the DB so any pending writes are flushed.
//   3) Exit cleanly so Railway doesn't think we crashed.
// Registered exactly once per process — safe under Next.js's hot module reload.
function registerShutdownHandlers() {
  if (_shutdownRegistered) return;
  _shutdownRegistered = true;

  const shutdown = (signal: string) => {
    if (!_db) {
      process.exit(0);
      return;
    }
    try {
      // TRUNCATE checkpoint flushes WAL into the main DB and zeroes the
      // WAL file — gives us a clean DB after restart, no recovery work.
      _db.pragma("wal_checkpoint(TRUNCATE)");
    } catch (err) {
      console.error(`[db] checkpoint on ${signal} failed:`, err);
    }
    try {
      _db.close();
    } catch (err) {
      console.error(`[db] close on ${signal} failed:`, err);
    }
    _stmtCache.clear();
    _db = null;
    // Letting Node exit naturally so Next.js can finish in-flight requests;
    // Railway gives us ~30s of grace before it sends SIGKILL.
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
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
    try {
      _db.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      // ignore — we're closing anyway
    }
    _db.close();
    _stmtCache.clear();
    _db = null;
  }
}
