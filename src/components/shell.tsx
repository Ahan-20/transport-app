"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
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
  { href: "/vehicles", label: "Vehicles" },
  { href: "/approvals", label: "Approvals", adminOnly: true },
  { href: "/health", label: "System", adminOnly: true },
];

export function Shell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu on route change so navigation feels responsive.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  if (isLogin || !user) {
    return <div className="min-h-screen">{children}</div>;
  }

  const visibleNav = nav.filter((item) => !item.adminOnly || user.role === "admin");

  return (
    <div className="min-h-screen pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 bg-[var(--color-bg)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/75">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4 md:gap-4 md:px-10">
          <Link href="/" className="flex items-baseline gap-2.5" onClick={() => setMenuOpen(false)}>
            <span className="serif text-[1.4rem] leading-none text-[var(--color-ink)] sm:text-[1.5rem]">
              Sanctum
            </span>
            <span className="label hidden sm:inline">Transport</span>
          </Link>

          {/* Desktop nav — hidden on phones */}
          <nav className="ml-4 hidden flex-1 items-center gap-1 md:flex lg:ml-6">
            {visibleNav.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-2 text-[0.8125rem] font-medium transition-colors lg:px-3.5 ${
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

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <div className="hidden text-right md:block">
              <div className="label">{user.role}</div>
              <div className="text-[0.8125rem] font-medium text-[var(--color-ink)]">
                {user.username}
              </div>
            </div>

            {/* Sign-out button — desktop only; mobile gets it inside the menu */}
            <form action="/api/auth/logout" method="post" className="hidden md:block">
              <button type="submit" className="btn btn-ghost">
                Sign out
              </button>
            </form>

            {/* Hamburger button — mobile only */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-rule)] text-[var(--color-ink)] active:bg-[var(--color-surface-2)] md:hidden"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        <StatusBar />
      </header>

      {/* Mobile slide-down menu */}
      {menuOpen ? (
        <div className="fixed inset-x-0 top-[3.5rem] bottom-0 z-30 overflow-y-auto bg-[var(--color-bg)] md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-4">
            {visibleNav.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-[1rem] font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                      : "border border-[var(--color-rule)] text-[var(--color-ink)] active:bg-[var(--color-surface-2)]"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-[var(--color-muted-2)]">→</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-2 border-t border-[var(--color-rule)] px-4 py-4">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="label">Signed in as</div>
              <div>
                <span className="text-[0.875rem] font-medium text-[var(--color-ink)]">
                  {user.username}
                </span>
                <span className="ml-2 label">{user.role}</span>
              </div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="btn btn-ghost w-full justify-center">
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <main className="min-w-0">
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-4 sm:px-6 md:px-10">
          {children}
        </div>
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
    <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 overflow-x-auto px-4 pb-3 text-[0.6875rem] sm:gap-5 sm:px-6 md:px-10">
      <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-positive)] opacity-50"></span>
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-positive)]"></span>
        </span>
        <span className="label">Live</span>
      </span>
      <span className="label whitespace-nowrap text-[var(--color-muted)]">{dateStr}</span>
      <span className="label whitespace-nowrap text-[var(--color-muted)]">
        FY {academicLabel(currentFiscalYear())}
      </span>
      <span className="label hidden text-[var(--color-muted)] sm:inline">Jaipur</span>
      <span className="ml-auto label hidden text-[var(--color-muted-2)] sm:inline">
        v0.2 · local
      </span>
    </div>
  );
}
