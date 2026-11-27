"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimelinePoint } from "@/types";

interface TimelineChartProps {
  timeline: TimelinePoint[];
}

export function TimelineChart({ timeline }: TimelineChartProps) {
  if (!timeline.length) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-slate-500">
        Chưa có dữ liệu biến thiên theo thời gian cho phiên này.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={timeline}
          margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            stroke="#64748b"
            tick={{ fill: "#64748b", fontSize: 12 }}
          />
          <YAxis
            yAxisId="left"
            domain={[0, 100]}
            stroke="#059669"
            tick={{ fill: "#059669", fontSize: 11 }}
            unit="%"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 220]}
            stroke="#d97706"
            tick={{ fill: "#d97706", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              borderColor: "#e2e8f0",
              borderRadius: "0.75rem",
              color: "#0f172a",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="eye_contact_rate"
            name="Eye Contact (%)"
            stroke="#059669"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#059669" }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="wpm"
            name="Tốc độ nói (WPM)"
            stroke="#d97706"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#d97706" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
