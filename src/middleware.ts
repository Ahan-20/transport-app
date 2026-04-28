import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import { sessionOptions } from "./lib/session";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/auth|api/health|api/admin/backup).*)"],
};

export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get(sessionOptions.cookieName)?.value;
  let ok = false;
  if (cookie) {
    try {
      const data = await unsealData<{ user?: unknown }>(cookie, {
        password: sessionOptions.password as string,
      });
      ok = !!data?.user;
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
