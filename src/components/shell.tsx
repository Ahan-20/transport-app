"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/session";
import { academicLabel, currentFiscalYear } from "@/lib/fiscal";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const nav: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/students", label: "Roster" },
  { href: "/payments", label: "Entry" },
  { href: "/pending", label: "Pending" },
  { href: "/payouts", label: "Payouts" },
  { href: "/drivers", label: "Drivers" },
  { href: "/routes", label: "Routes" },
  { href: "/approvals", label: "Approvals", adminOnly: true },
  { href: "/health", label: "System", adminOnly: true },
];

export function Shell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin || !user) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-[var(--color-bg)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/75">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-6 py-4 md:px-10">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="serif text-[1.5rem] leading-none text-[var(--color-ink)]">
              Sanctum
            </span>
            <span className="label hidden sm:inline">Transport</span>
          </Link>

          <nav className="ml-6 flex flex-1 items-center gap-1">
            {nav.filter((item) => !item.adminOnly || user.role === "admin").map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3.5 py-2 text-[0.8125rem] font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                      : "text-[var(--color-ink-2)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <div className="label">{user.role}</div>
              <div className="text-[0.8125rem] font-medium text-[var(--color-ink)]">
                {user.username}
              </div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="btn btn-ghost"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <StatusBar />
      </header>

      <main className="min-w-0">
        <div className="mx-auto w-full max-w-[1400px] px-6 pb-10 pt-4 md:px-10">{children}</div>
      </main>
    </div>
  );
}

function StatusBar() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return (
    <div className="mx-auto flex w-full max-w-[1400px] items-center gap-5 px-6 pb-3 text-[0.6875rem] md:px-10">
      <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-positive)] opacity-50"></span>
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-positive)]"></span>
        </span>
        <span className="label">Live</span>
      </span>
      <span className="label text-[var(--color-muted)]">{dateStr}</span>
      <span className="label text-[var(--color-muted)]">
        FY {academicLabel(currentFiscalYear())}
      </span>
      <span className="label text-[var(--color-muted)]">Jaipur</span>
      <span className="ml-auto label text-[var(--color-muted-2)]">v0.2 · local</span>
    </div>
  );
}
