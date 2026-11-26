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
      <div className="flex h-72 items-center justify-center text-sm text-slate-400">
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
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="label"
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
          />
          <YAxis
            yAxisId="left"
            domain={[0, 100]}
            stroke="#34d399"
            tick={{ fill: "#34d399", fontSize: 11 }}
            unit="%"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 220]}
            stroke="#f59e0b"
            tick={{ fill: "#f59e0b", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              borderColor: "#334155",
              borderRadius: "0.75rem",
              color: "#f8fafc",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="eye_contact_rate"
            name="Eye Contact (%)"
            stroke="#34d399"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#34d399" }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="wpm"
            name="Tốc độ nói (WPM)"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#f59e0b" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
