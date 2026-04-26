"use client";

import { Printer } from "lucide-react";

// Tiny client island so server components can include a "Print" trigger
// without converting the whole page. Calls the browser's print dialog,
// which respects the @media print rules in globals.css.
export function PrintButton({
  className = "btn btn-ghost",
  label = "Print",
  title = "Print this list",
}: {
  className?: string;
  label?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`${className} print:hidden`}
      title={title}
    >
      <Printer size={13} />
      {label}
    </button>
  );
}
