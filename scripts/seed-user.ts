import bcrypt from "bcryptjs";
import { getDb, closeDb } from "../src/lib/db";

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];
  const role = (process.argv[4] as "admin" | "staff") ?? "staff";
  const fullName = process.argv[5] ?? username;

  if (!username || !password) {
    console.error(
      "Usage: npx tsx scripts/seed-user.ts <username> <password> [role=staff] [fullName]",
    );
    process.exit(1);
  }

  const db = getDb();
  const hash = await bcrypt.hash(password, 10);
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as
    | { id: number }
    | undefined;

  if (existing) {
    db.prepare(
      "UPDATE users SET password_hash = ?, full_name = ?, role = ?, active = 1 WHERE id = ?",
    ).run(hash, fullName, role, existing.id);
    console.log(`Reset ${username} (${role})`);
  } else {
    db.prepare(
      "INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, 1)",
    ).run(username, hash, fullName, role);
    console.log(`Created ${role} user ${username}`);
  }
  closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
