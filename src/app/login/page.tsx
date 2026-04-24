import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session.user) redirect("/");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-paper)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 80% -10%, rgba(178,58,28,0.08), transparent 50%), radial-gradient(ellipse at -10% 110%, rgba(47,107,59,0.06), transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, #000 0 1px, transparent 1px 28px)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1200px] flex-col px-10 py-8">
        <header className="flex items-baseline justify-between">
          <div className="font-display text-xl leading-none tracking-tight">
            Sanctum<span className="text-[var(--color-accent)]">.</span>
          </div>
          <div className="label">AY 2026–27</div>
        </header>

        <main className="flex flex-1 items-center">
          <div className="grid w-full gap-16 lg:grid-cols-[1.15fr_1fr] lg:gap-24">
            <section className="flex flex-col justify-center fade-in">
              <div className="label mb-5">Transport · Operations Ledger</div>
              <h1 className="font-display text-[clamp(2.6rem,5vw,4.4rem)] font-normal leading-[1.02] tracking-tight text-[var(--color-ink)]">
                A ledger for every <em className="italic text-[var(--color-accent)]">seat</em>,<br />
                every <em className="italic">month</em>, every <em className="italic">rupee</em>.
              </h1>
              <p className="mt-6 max-w-[28rem] text-[0.95rem] leading-relaxed text-[var(--color-ink-2)]">
                Sanctum World School &amp; Sanctum Academy — Jaipur. One screen for payment entry,
                drivers, routes, and twelve-month collections. Built to be faster than the sheet.
              </p>

              <dl className="mt-10 grid grid-cols-3 gap-6 max-w-md">
                <Stat label="Active students" value="632" />
                <Stat label="Drivers" value="11" />
                <Stat label="Routes" value="15" />
              </dl>
            </section>

            <section className="flex items-center">
              <div className="card w-full max-w-sm p-8">
                <div className="label">Sign in</div>
                <h2 className="mt-2 font-display text-2xl tracking-tight">Office access</h2>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Use the credentials issued by the administrator.
                </p>
                <div className="mt-6">
                  <LoginForm />
                </div>
                <div className="mt-6 border-t border-[var(--color-rule)] pt-4 text-[0.7rem] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Local · encrypted · local-only
                </div>
              </div>
            </section>
          </div>
        </main>

        <footer className="flex items-center justify-between text-[0.7rem] uppercase tracking-[0.14em] text-[var(--color-muted)]">
          <span>Jaipur · Rajasthan</span>
          <span>v0.1 · Phase 2</span>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-3xl leading-none tracking-tight">{value}</div>
      <div className="mt-2 text-[0.6875rem] uppercase tracking-[0.14em] text-[var(--color-muted)]">
        {label}
      </div>
    </div>
  );
}
