import Link from "next/link";
import { Pencil } from "lucide-react";

export function EditPill({
  href,
  label = "Edit",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-rule)] px-3 py-1 text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-2)] hover:border-[var(--color-ink)]"
    >
      <Pencil size={11} /> {label}
    </Link>
  );
}
