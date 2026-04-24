import bcrypt from "bcryptjs";
import { getDb } from "./db";
import type { SessionUser } from "./session";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyUser(username: string, password: string): Promise<SessionUser | null> {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, username, password_hash, full_name, role, active FROM users WHERE username = ?",
    )
    .get(username.trim()) as
    | {
        id: number;
        username: string;
        password_hash: string;
        full_name: string | null;
        role: "admin" | "staff";
        active: number;
      }
    | undefined;
  if (!row || !row.active) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
  };
}
