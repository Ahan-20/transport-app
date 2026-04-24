import bcrypt from "bcryptjs";
import { getDb, closeDb } from "../src/lib/db";

async function main() {
  const username = process.argv[2] ?? "admin";
  const password = process.argv[3] ?? "admin123";
  const fullName = process.argv[4] ?? "Administrator";

  const db = getDb();
  const hash = await bcrypt.hash(password, 10);
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as
    | { id: number }
    | undefined;

  if (existing) {
    db.prepare("UPDATE users SET password_hash = ?, full_name = ?, role='admin', active=1 WHERE id = ?")
      .run(hash, fullName, existing.id);
    console.log(`Reset password for ${username}`);
  } else {
    db.prepare(
      "INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, 'admin', 1)",
    ).run(username, hash, fullName);
    console.log(`Created admin user ${username}`);
  }
  console.log(`Password: ${password}`);
  closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
