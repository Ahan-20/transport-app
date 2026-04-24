import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export type SessionUser = {
  id: number;
  username: string;
  fullName: string | null;
  role: "admin" | "staff";
};

export type AppSession = {
  user?: SessionUser;
};

const password =
  process.env.SESSION_PASSWORD ??
  "dev-local-session-password-at-least-32-characters-long-xxxxxxxxxxxxxxx";

export const sessionOptions: SessionOptions = {
  cookieName: "sanctum_transport_session",
  password,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    httpOnly: true,
    path: "/",
  },
};

export async function getSession() {
  const store = await cookies();
  return getIronSession<AppSession>(store, sessionOptions);
}
