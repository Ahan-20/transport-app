"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { MONTHS, MONTH_LABEL } from "@/lib/fiscal";

type Driver = { id: number; name: string };
type School = { code: string; name: string };

export function StudentFilters({
  drivers,
  schools,
  classes,
  statusCounts,
}: {
  drivers: Driver[];
  schools: School[];
  classes: string[];
  statusCounts: { active: number; archived: number };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  useEffect(() => {
    setQ(sp.get("q") ?? "");
  }, [sp]);

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`/students?${next.toString()}`);
    },
    [router, sp],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const cur = sp.get("q") ?? "";
      if (q !== cur) update("q", q);
    }, 180);
    return () => clearTimeout(t);
  }, [q, sp, update]);

  const currentStatus = sp.get("status") ?? "ACTIVE";

  return (
    <div className="card px-4 py-3 space-y-3">
      {/* Active / Archived toggle — the primary way to see students who have
          left the school. Sits above the filter row so it's impossible to
          miss. Counts make it obvious archived students exist. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1">Show</span>
        <StatusPill
          label="Active"
          count={statusCounts.active}
          selected={currentStatus === "ACTIVE"}
          onClick={() => update("status", "")}
        />
        <StatusPill
          label="Archived"
          count={statusCounts.archived}
          selected={currentStatus === "ARCHIVED"}
          onClick={() => update("status", "ARCHIVED")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            className="input pl-9"
            placeholder="Search name, हिन्दी, or contact"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Select
          label="School"
          value={sp.get("school") ?? ""}
          onChange={(v) => update("school", v)}
          options={[
            { value: "", label: "All" },
            ...schools.map((s) => ({ value: s.code, label: s.code })),
          ]}
        />
        <Select
          label="Driver"
          value={sp.get("driverId") ?? ""}
          onChange={(v) => update("driverId", v)}
          options={[
            { value: "", label: "All" },
            ...drivers.map((d) => ({ value: String(d.id), label: d.name })),
          ]}
        />
        <Select
          label="Class"
          value={sp.get("klass") ?? ""}
          onChange={(v) => update("klass", v)}
          options={[
            { value: "", label: "All" },
            ...classes.map((c) => ({ value: c, label: c })),
          ]}
        />
        <Select
          label="Month"
          value={sp.get("month") ?? ""}
          onChange={(v) => update("month", v)}
          options={[
            { value: "", label: "Current" },
            { value: "ALL", label: "All months" },
            ...MONTHS.map((m) => ({ value: m, label: MONTH_LABEL[m] })),
          ]}
        />
        <Select
          label="Payment"
          value={sp.get("payment") ?? "all"}
          onChange={(v) => update("payment", v === "all" ? "" : v)}
          options={[
            { value: "all", label: "All" },
            { value: "unpaid", label: "Unpaid only" },
            { value: "paid", label: "Paid only" },
          ]}
        />
        <Select
          label="Foundation"
          value={sp.get("foundation") ?? ""}
          onChange={(v) => update("foundation", v)}
          options={[
            { value: "", label: "Any" },
            { value: "yes", label: "Foundation only" },
            { value: "no", label: "Non-foundation" },
          ]}
        />
        <Select
          label="Form"
          value={sp.get("form") ?? ""}
          onChange={(v) => update("form", v)}
          options={[
            { value: "", label: "Any" },
            { value: "yes", label: "Form submitted" },
            { value: "no", label: "Form pending" },
          ]}
        />
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="label">{label}</span>
      <select
        className="input h-auto w-auto min-w-[7rem] py-1.5 pr-8 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[0.8125rem] font-medium transition-colors ${
        selected
          ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
          : "border border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`num text-[0.75rem] ${
          selected ? "text-[var(--color-bg)]/70" : "text-[var(--color-muted)]"
        }`}
      >
        {count.toLocaleString("en-IN")}
      </span>
    </button>
  );
}
