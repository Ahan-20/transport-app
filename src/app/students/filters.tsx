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
}: {
  drivers: Driver[];
  schools: School[];
  classes: string[];
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

  return (
    <div className="card px-4 py-3">
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
          label="Status"
          value={sp.get("status") ?? "ACTIVE"}
          onChange={(v) => update("status", v === "ACTIVE" ? "" : v)}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "ARCHIVED", label: "Archived" },
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
