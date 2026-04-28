"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { MONTHS, MONTH_LABEL } from "@/lib/fiscal";

type Driver = { id: number; name: string };

export function HistoryFilters({ drivers }: { drivers: Driver[] }) {
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
      router.replace(`/history?${next.toString()}`);
    },
    [router, sp],
  );

  // Debounced free-text search.
  useEffect(() => {
    const t = setTimeout(() => {
      const cur = sp.get("q") ?? "";
      if (q !== cur) update("q", q);
    }, 180);
    return () => clearTimeout(t);
  }, [q, sp, update]);

  return (
    <div className="card px-4 py-3 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            className="input pl-9"
            placeholder="Search student name or हिन्दी"
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
            { value: "SWS", label: "SWS" },
            { value: "SA", label: "SA" },
          ]}
        />
        <Select
          label="Driver"
          value={sp.get("driver") ?? ""}
          onChange={(v) => update("driver", v)}
          options={[
            { value: "", label: "All" },
            ...drivers.map((d) => ({ value: String(d.id), label: d.name })),
          ]}
        />
        <Select
          label="Month"
          value={sp.get("month") ?? ""}
          onChange={(v) => update("month", v)}
          options={[
            { value: "", label: "All" },
            ...MONTHS.map((m) => ({ value: m, label: MONTH_LABEL[m] })),
          ]}
        />
        <Select
          label="Mode"
          value={sp.get("mode") ?? ""}
          onChange={(v) => update("mode", v)}
          options={[
            { value: "", label: "All" },
            { value: "CASH", label: "Cash" },
            { value: "UPI", label: "UPI" },
            { value: "BANK", label: "Bank" },
            { value: "CHEQUE", label: "Cheque" },
          ]}
        />

        <DateField
          label="From"
          value={sp.get("from") ?? ""}
          onChange={(v) => update("from", v)}
        />
        <DateField
          label="To"
          value={sp.get("to") ?? ""}
          onChange={(v) => update("to", v)}
        />

        {[...sp.keys()].length > 0 ? (
          <button
            type="button"
            onClick={() => router.replace("/history")}
            className="mono text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            × Clear all
          </button>
        ) : null}
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
        className="input h-auto w-auto min-w-[6rem] py-1.5 pr-8 text-xs"
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

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="label">{label}</span>
      <input
        type="date"
        className="input h-auto w-auto py-1.5 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
