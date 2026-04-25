import bcrypt from "bcryptjs";
import { getDb } from "./db";
import type { SessionUser } from "./session";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

// Constant-time string comparison so attackers can't time-attack the override.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Emergency override: when EMERGENCY_ADMIN_PASSWORD is set on Railway, the
// admin user can log in with that exact value, bypassing the bcrypt-hashed
// DB row entirely. Use ONLY if the normal hash flow is broken; remove the
// env var as soon as you've recovered access.
function tryEmergencyOverride(username: string, password: string): SessionUser | null {
  const overrideUsername = (process.env.EMERGENCY_ADMIN_USERNAME ?? "admin").trim();
  const overridePassword = process.env.EMERGENCY_ADMIN_PASSWORD?.trim();
  if (!overridePassword) return null;
  if (username.trim() !== overrideUsername) return null;
  if (!timingSafeEqual(password, overridePassword)) return null;

  // Look up the stored row to reuse the real id/role rather than synthesizing.
  const row = getDb()
    .prepare(
      "SELECT id, username, full_name, role, active FROM users WHERE username = ?",
    )
    .get(overrideUsername) as
    | {
        id: number;
        username: string;
        full_name: string | null;
        role: "admin" | "staff";
        active: number;
      }
    | undefined;
  if (!row || !row.active) return null;
  console.log(`[auth] EMERGENCY_ADMIN_PASSWORD override accepted for "${row.username}"`);
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
  };
}

export async function verifyUser(username: string, password: string): Promise<SessionUser | null> {
  // Emergency override is checked first so a broken bcrypt hash can't lock
  // an admin out of their own system.
  const override = tryEmergencyOverride(username, password);
  if (override) return override;

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
  // Wrap bcrypt.compare so a corrupted hash returns "wrong password" instead
  // of crashing the request with a 500.
  let ok = false;
  try {
    ok = await bcrypt.compare(password, row.password_hash);
  } catch (err) {
    console.error(`[auth] bcrypt.compare threw for "${row.username}":`, err);
    return null;
  }
  if (!ok) return null;
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
  };
}
