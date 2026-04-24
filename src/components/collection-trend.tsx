"use client";

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Datum = {
  month: string;
  expected: number;
  actual: number;
  sws: number;
  sa: number;
};

export function CollectionTrend({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f43ff" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#1f43ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e2e2de" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "#6b6b68", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e2de" }}
        />
        <YAxis
          tick={{ fill: "#6b6b68", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => {
            if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
            if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
            return String(v);
          }}
        />
        <Tooltip
          cursor={{ stroke: "#0a0a0a", strokeWidth: 1, strokeDasharray: "3 3" }}
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #0a0a0a",
            borderRadius: 0,
            fontSize: 11,
            padding: "8px 10px",
            fontFamily: "var(--font-mono)",
          }}
          formatter={(v, name) => [`₹${Math.round(Number(v)).toLocaleString("en-IN")}`, name]}
        />
        <Area
          type="monotone"
          dataKey="actual"
          stroke="#1f43ff"
          strokeWidth={1.75}
          fill="url(#fillActual)"
          name="COLLECTED"
        />
        <Line
          type="monotone"
          dataKey="expected"
          stroke="#0a0a0a"
          strokeWidth={1}
          strokeDasharray="3 3"
          dot={false}
          name="EXPECTED"
        />
        <Line
          type="monotone"
          dataKey="sws"
          stroke="#087f3a"
          strokeWidth={1}
          dot={false}
          name="SWS"
        />
        <Line
          type="monotone"
          dataKey="sa"
          stroke="#b25b00"
          strokeWidth={1}
          dot={false}
          name="SA"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
